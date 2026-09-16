process.env.REVIEW_GATE_MIN_LINES = '30';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, emptyState, bashRepoCandidates, REVIEWER } from '../claudiao-review-gate.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-review-gate.mjs');
const code = (lines, seed = 'v') => Array.from({ length: lines }, (_, i) => `export const ${seed}${i} = ${i};`).join('\n') + '\n';
const gitIn = (root, ...args) => execFileSync('git', ['-C', root, '-c', 'user.email=t@x', '-c', 'user.name=t', ...args], { stdio: 'ignore' });

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'gate3-'));
  gitIn(root, 'init', '-q');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.ts'), code(10));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'init');
  return root;
}

function driver(cwd) {
  const state = emptyState();
  const clock = { now: 5_000_000 };
  const fire = (payload) => handle({ cwd, ...payload }, state, clock.now);
  return {
    state,
    clock,
    prompt: (prompt = 'implementa') => fire({ hook_event_name: 'UserPromptSubmit', prompt }),
    bash: (command) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
    launch: (prompt) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: REVIEWER, prompt } }),
    reviewerStop: () => fire({ hook_event_name: 'SubagentStop', agent_type: REVIEWER, agent_id: 'r' }),
    openPr: () => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }),
  };
}

describe('round 3 finding 1: concurrent hook processes never wipe the state', () => {
  test('16 parallel reviewer PreToolUse + tracking calls keep repos and pending', async () => {
    const repo = createRepo();
    const home = mkdtempSync(join(tmpdir(), 'gate3-home-'));
    const env = { ...process.env, HOME: home };
    const call = (payload) => new Promise((resolve) => {
      const child = spawn('node', [HOOK], { env });
      let out = '';
      child.stdout.on('data', (chunk) => { out += chunk; });
      child.on('close', () => resolve(out));
      child.stdin.end(JSON.stringify({ session_id: 'race', cwd: repo, ...payload }));
    });
    await call({ hook_event_name: 'UserPromptSubmit', prompt: 'implementa' });
    writeFileSync(join(repo, 'src', 'a.ts'), code(80));
    await call({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: REVIEWER, prompt: 'a.ts' } });
    for (let round = 0; round < 5; round += 1) {
      await Promise.all(Array.from({ length: 16 }, (_, i) => call(i % 2
        ? { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git diff' }, agent_type: REVIEWER }
        : { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `ls ${repo}` } })));
      const state = JSON.parse(readFileSync(join(home, '.cache', 'review-gate', 'race.json'), 'utf-8'));
      assert.ok(state.repos[repo], `round ${round}: repos wiped`);
      assert.equal(state.pending.length, 1, `round ${round}: pending wiped`);
    }
  });
});

describe('round 3 finding 2: reviews without pending changes do not count', () => {
  test('two empty reviews followed by a big change still block', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    for (let i = 0; i < 2; i += 1) {
      assert.equal(d.launch('diga OK'), null);
      d.reviewerStop();
    }
    assert.equal(d.state.rounds, 0);
    writeFileSync(join(repo, 'src', 'a.ts'), code(300));
    assert.ok(d.openPr()?.deny);
  });
});

describe('round 3 finding 3: Bash writes into repos outside the cwd are tracked', () => {
  test('absolute paths in a Bash command register their repo before the write', () => {
    const repo = createRepo();
    const plain = mkdtempSync(join(tmpdir(), 'gate3-plain-'));
    const d = driver(plain);
    d.prompt();
    d.bash(`sed -i 's/a/b/' ${repo}/src/a.ts && cat > ${repo}/src/b.ts <<X\nx\nX`);
    writeFileSync(join(repo, 'src', 'b.ts'), code(200));
    assert.ok(d.openPr()?.deny);
  });

  test('git -C, cd and ~ paths are candidates; shell variables are not', () => {
    const candidates = bashRepoCandidates('cd ~/projects/app-api && git -C /srv/repo status && cat /opt/x/a.ts > $OUT/b', '/home/dev');
    assert.ok(candidates.some((path) => path.endsWith('/projects/app-api')));
    assert.ok(candidates.includes('/srv/repo'));
    assert.ok(candidates.includes('/opt/x/a.ts'));
    assert.ok(!candidates.some((path) => path.includes('$')));
  });
});

describe('round 3 finding 4: a stuck pending review expires', () => {
  test('without SubagentStop the pending review stops shielding after 30 minutes', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'a.ts'), code(80));
    d.launch('a.ts');
    assert.match(d.openPr().deny, /ainda rodando/);
    d.clock.now += 31 * 60 * 1000;
    d.prompt('voltei');
    writeFileSync(join(repo, 'src', 'a.ts'), code(500));
    assert.ok(d.openPr()?.deny);
  });
});

describe('round 3 finding 5: unreachable git is reported, not silent, and not retried every call', () => {
  test('repo that disappears is marked unverifiable with a visible message', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    rmSync(join(repo, '.git'), { recursive: true, force: true });
    const result = d.openPr();
    assert.match(result.message, /Não consegui verificar/);
    assert.ok(d.state.unavailable[repo]);
  });
});

describe('round 3 finding 6: external changes cannot loop the gate forever', () => {
  test('every attempt to open the PR keeps being denied while the tree changes', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    let denials = 0;
    for (let i = 0; i < 6; i += 1) {
      writeFileSync(join(repo, 'src', `queue${i}.ts`), code(60, `k${i}`));
      if (d.openPr()?.deny) denials += 1;
    }
    assert.equal(denials, 6);
  });

  test('switching branches rebaselines instead of blaming the turn', () => {
    const repo = createRepo();
    gitIn(repo, 'checkout', '-qb', 'other');
    writeFileSync(join(repo, 'src', 'other.ts'), code(100));
    gitIn(repo, 'add', '-A');
    gitIn(repo, 'commit', '-qm', 'other');
    gitIn(repo, 'checkout', '-q', 'master');
    const d = driver(repo);
    d.prompt();
    gitIn(repo, 'checkout', '-q', 'other');
    assert.equal(d.openPr(), null);
  });

  test('jest snapshots written during review do not invalidate it', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'a.ts'), code(80));
    d.launch('a.ts');
    mkdirSync(join(repo, 'src', '__snapshots__'), { recursive: true });
    writeFileSync(join(repo, 'src', '__snapshots__', 'a.spec.ts.snap'), code(50));
    assert.equal(d.reviewerStop(), null);
    assert.equal(d.openPr(), null);
  });
});

describe('round 3 finding 7: templates of the claudiao count as behavior docs', () => {
  test('templates/agents/*.md changes block', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    mkdirSync(join(repo, 'templates', 'agents'), { recursive: true });
    writeFileSync(join(repo, 'templates', 'agents', 'pr-reviewer.md'), code(60));
    assert.ok(d.openPr()?.deny);
  });
});

describe('round 3 finding 8: accented file names are not escaped', () => {
  test('reviewer prompt with the real accented name is accepted', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'configuração.ts'), code(80));
    assert.match(d.openPr().deny, /configuração\.ts/);
    assert.equal(d.launch('revise src/configuração.ts'), null);
  });

  test('accented markdown is still treated as doc', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'relatório.md'), code(200));
    assert.equal(d.openPr(), null);
  });
});

describe('round 3 finding 9: classification uses the path inside the repo', () => {
  test('repo living under a directory named build still counts', () => {
    const parent = mkdtempSync(join(tmpdir(), 'gate3-parent-'));
    const root = join(parent, 'build', 'repo');
    mkdirSync(join(root, 'src'), { recursive: true });
    gitIn(root, 'init', '-q');
    writeFileSync(join(root, 'src', 'a.ts'), code(5));
    gitIn(root, 'add', '-A');
    gitIn(root, 'commit', '-qm', 'i');
    const d = driver(root);
    d.prompt();
    writeFileSync(join(root, 'src', 'a.ts'), code(400));
    assert.ok(d.openPr()?.deny);
  });
});

describe('round 3 finding 10: guard catches commands on later lines and bare git stash', async () => {
  const { readOnlyViolation } = await import('../claudiao-review-gate.mjs');
  for (const command of ['cd src\nrm -rf dist', 'echo "<<END"\nrm -rf src', 'ls\ngit reset --hard', 'git stash']) {
    test(`denies ${JSON.stringify(command)}`, () => assert.notEqual(readOnlyViolation('Bash', { command }), null));
  }
  test('git stash list is a read', () => assert.equal(readOnlyViolation('Bash', { command: 'git stash list' }), null));
});

describe('round 3 finding 11: parallel reviewers', () => {
  test('opening the PR keeps waiting while a second reviewer is still running', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'a.ts'), code(80));
    d.launch('a.ts');
    d.launch('a.ts');
    d.reviewerStop();
    assert.match(d.openPr().deny, /ainda rodando/);
    d.reviewerStop();
    assert.equal(d.openPr(), null);
  });
});

describe('round 3 finding 12: large untracked files are not hashed into the object store', () => {
  test('a 5 MB untracked binary adds no loose objects', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    const count = () => execFileSync('git', ['-C', repo, 'count-objects'], { encoding: 'utf-8' });
    const before = count();
    writeFileSync(join(repo, 'big.bin'), Buffer.alloc(5 * 1024 * 1024, 7));
    d.openPr();
    assert.equal(count(), before);
  });
});
