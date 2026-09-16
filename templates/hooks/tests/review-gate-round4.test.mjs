process.env.REVIEW_GATE_MIN_LINES = '30';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, emptyState, readOnlyViolation, REVIEWER } from '../claudiao-review-gate.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-review-gate.mjs');
const code = (lines, seed = 'v') => Array.from({ length: lines }, (_, i) => `export const ${seed}${i} = ${i};`).join('\n') + '\n';
const gitIn = (root, ...args) => execFileSync('git', ['-C', root, '-c', 'user.email=t@x', '-c', 'user.name=t', ...args], { stdio: 'ignore' });

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'gate4-'));
  gitIn(root, 'init', '-q', '-b', 'main');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.ts'), code(10));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'init');
  return root;
}

function driver(cwd) {
  const state = emptyState();
  const clock = { now: 9_000_000 };
  const fire = (payload) => handle({ cwd, ...payload }, state, clock.now);
  return {
    state,
    clock,
    prompt: (prompt = 'implementa') => fire({ hook_event_name: 'UserPromptSubmit', prompt }),
    edit: (file) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(cwd, file) } }),
    openPr: () => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }),
  };
}

describe('round 4 finding 1: branch changes do not erase unreviewed edits', () => {
  test('checkout -b with a dirty tree still blocks', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'a.ts'), code(90));
    gitIn(repo, 'checkout', '-qb', 'feature/x');
    assert.ok(d.openPr()?.deny);
  });

  test('committing the edits on a new branch still blocks', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'a.ts'), code(90));
    gitIn(repo, 'checkout', '-qb', 'feature/y');
    gitIn(repo, 'commit', '-qam', 'feat: y');
    assert.ok(d.openPr()?.deny);
  });

  test('checking out a branch that is ahead of the base branch still needs review', () => {
    const repo = createRepo();
    gitIn(repo, 'checkout', '-qb', 'other');
    writeFileSync(join(repo, 'src', 'other.ts'), code(100));
    gitIn(repo, 'add', '-A');
    gitIn(repo, 'commit', '-qm', 'other');
    gitIn(repo, 'checkout', '-q', 'main');
    const d = driver(repo);
    d.prompt();
    gitIn(repo, 'checkout', '-q', 'other');
    assert.ok(d.openPr()?.deny);
  });

  test('switching branches and then editing counts the new edits', () => {
    const repo = createRepo();
    gitIn(repo, 'checkout', '-qb', 'other');
    writeFileSync(join(repo, 'src', 'other.ts'), code(100));
    gitIn(repo, 'add', '-A');
    gitIn(repo, 'commit', '-qm', 'other');
    gitIn(repo, 'checkout', '-q', 'main');
    const d = driver(repo);
    d.prompt();
    gitIn(repo, 'checkout', '-q', 'other');
    writeFileSync(join(repo, 'src', 'other.ts'), code(160));
    assert.ok(d.openPr()?.deny);
  });
});

describe('round 4 finding 2: transient git failures are retried each turn and never silently adopt a dirty baseline', () => {
  test('snapshot failure, edit, recovery after 10 min: stop warns instead of staying silent', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    delete d.state.repos[repo];
    d.state.unavailable[repo] = d.clock.now;
    d.state.failedThisTurn[repo] = true;
    writeFileSync(join(repo, 'src', 'a.ts'), code(90));
    d.clock.now += 11 * 60 * 1000;
    d.edit('src/a.ts');
    assert.ok(d.state.repos[repo]?.lateBaseline);
    const result = d.openPr();
    assert.ok(result, 'stop must not be silent');
    assert.match(result.message ?? result.deny, /Não consegui verificar/);
  });

  test('a new prompt clears the unavailable mark and tracks again', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.state.unavailable[repo] = d.clock.now;
    d.prompt();
    assert.ok(d.state.repos[repo]);
    writeFileSync(join(repo, 'src', 'a.ts'), code(90));
    assert.ok(d.openPr()?.deny);
  });
});

describe('round 4 findings 3, 4 and 6: reviewer guard', () => {
  const denied = [
    'git stash -u', 'git stash --keep-index', 'git -C /r stash -p', 'git stash push -m x', 'git config --global user.name x', 'git config --unset core.x',
    'git config user.email x@y', 'git tag -a v1 -m x', 'git tag v2', 'git branch novo', 'git branch -D x', 'git remote add o url', 'git worktree add ../x',
    "echo 'a\n' ; rm -rf target", "jq '.a\n' f.json > out.json", 'timeout 5 rm -rf x', 'command rm -rf x', '{ rm -rf x; }', 'cat f | xargs rm',
    'grep x <<< foo\nrm -rf y', 'echo x > "/tmp/../home/u/f"', 'echo x > /tmp/../home/u/f', 'nohup rm -rf x &',
  ];
  for (const command of denied) {
    test(`denies ${JSON.stringify(command)}`, () => assert.notEqual(readOnlyViolation('Bash', { command }), null));
  }

  const allowed = [
    'git stash list', 'git stash show -p', 'git config --get user.email', 'git config -l', 'git config --global --get user.name', 'git config user.email',
    'git tag', 'git tag -l', 'git tag --contains HEAD', 'git branch', 'git branch -a', 'git branch --show-current', 'git remote -v', 'git remote get-url origin',
    'git worktree list', 'git submodule status', "echo 'multi\nline' | wc -l", "cat > /tmp/x.mjs <<'EOF'\nrm -rf src\nEOF\nnode /tmp/x.mjs --dry",
    'grep x <<< foo', 'echo x > "/tmp/rv/out.txt"', 'npx tsc --noEmit 2>&1 | tail',
  ];
  for (const command of allowed) {
    test(`allows ${JSON.stringify(command)}`, () => assert.equal(readOnlyViolation('Bash', { command }), null));
  }
});

describe('round 4 finding 5: orphan lock from a killed hook is reclaimed quickly', () => {
  test('lock owned by a dead pid does not delay the next hook', () => {
    const home = mkdtempSync(join(tmpdir(), 'gate4-home-'));
    const lock = join(home, '.cache', 'review-gate', 'orphan.json.lock');
    mkdirSync(lock, { recursive: true });
    const dead = spawnSync('node', ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' }).stdout;
    writeFileSync(join(lock, 'pid'), dead);
    const repo = createRepo();
    const started = Date.now();
    const result = spawnSync('node', [HOOK], { input: JSON.stringify({ session_id: 'orphan', hook_event_name: 'UserPromptSubmit', prompt: 'x', cwd: repo }), encoding: 'utf-8', env: { ...process.env, HOME: home } });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(Date.now() - started < 1500, `took ${Date.now() - started} ms`);
  });
});
