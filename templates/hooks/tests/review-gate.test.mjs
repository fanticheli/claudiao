process.env.REVIEW_GATE_MIN_LINES = '30';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, render, readOnlyViolation, reviewerGuard, isReviewableFile, emptyState, REVIEWER } from '../claudiao-review-gate.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-review-gate.mjs');
const code = (lines, seed = 'value') => Array.from({ length: lines }, (_, i) => `export const ${seed}${i} = ${i};`).join('\n') + '\n';

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'gate-repo-'));
  const run = (...args) => execFileSync('git', ['-C', root, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], { stdio: 'ignore' });
  run('init', '-q');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'queue.service.ts'), code(10));
  writeFileSync(join(root, 'README.md'), '# repo\n');
  run('add', '-A');
  run('commit', '-qm', 'init');
  return { root, write: (path, content) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); } };
}

function session(repo) {
  const state = emptyState();
  let clock = 1_000_000;
  const fire = (payload) => handle(payload, state, clock);
  return {
    state,
    advance: (ms) => { clock += ms; },
    prompt: (prompt = 'implementa a fila') => fire({ hook_event_name: 'UserPromptSubmit', prompt, cwd: repo.root }),
    preEdit: (path) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(repo.root, path) }, cwd: repo.root }),
    preBash: (command, cwd = repo.root) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd }),
    launchReviewer: (prompt) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: REVIEWER, description: 'review', prompt }, cwd: repo.root }),
    reviewerTool: (tool_name, tool_input) => fire({ hook_event_name: 'PreToolUse', tool_name, tool_input, agent_type: REVIEWER, agent_id: 'rev1', cwd: repo.root }),
    reviewerStop: () => fire({ hook_event_name: 'SubagentStop', agent_type: REVIEWER, agent_id: 'rev1' }),
    otherSubagentStop: () => fire({ hook_event_name: 'SubagentStop', agent_type: 'general-purpose', agent_id: 'gp1' }),
    openPr: () => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' }, cwd: repo.root }),
  };
}

describe('review gate over real git trees', () => {
  let repo;
  let s;
  beforeEach(() => {
    repo = createRepo();
    s = session(repo);
  });

  test('no changes: stop is allowed', () => {
    s.prompt('explica o fluxo');
    assert.equal(s.openPr(), null);
  });

  test('large code change without review blocks with the changed file listed', () => {
    s.prompt();
    s.preEdit('src/queue.service.ts');
    repo.write('src/queue.service.ts', code(60));
    const result = s.openPr();
    assert.match(result.deny, /queue\.service\.ts/);
    assert.match(result.deny, /PR bloqueado/);
  });

  test('uncommitted changes made before this turn still go into the PR and need review', () => {
    repo.write('src/queue.service.ts', code(80, 'old'));
    s.prompt();
    assert.ok(s.openPr()?.deny);
  });

  test('changes from an earlier turn are not forgotten when the user asks for the PR later', () => {
    s.prompt('implementa a fila');
    s.preEdit('src/queue.service.ts');
    repo.write('src/queue.service.ts', code(80));
    s.prompt('abre o PR');
    assert.ok(s.openPr()?.deny);
  });

  test('small change below the 60 line threshold is allowed', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(10).replace('value3 = 3', 'value3 = 4'));
    assert.equal(s.openPr(), null);
  });

  test('the line threshold decides both ways', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(40));
    const previous = process.env.REVIEW_GATE_MIN_LINES;
    try {
      process.env.REVIEW_GATE_MIN_LINES = '1000';
      assert.equal(s.openPr(), null);
      process.env.REVIEW_GATE_MIN_LINES = '5';
      assert.ok(s.openPr()?.deny);
    } finally {
      if (previous === undefined) delete process.env.REVIEW_GATE_MIN_LINES;
      else process.env.REVIEW_GATE_MIN_LINES = previous;
    }
  });

  test('rewriting a whole file with a one line difference counts only the real diff', () => {
    repo.write('src/config.ts', code(200));
    execFileSync('git', ['-C', repo.root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repo.root, '-c', 'user.email=t@x', '-c', 'user.name=t', 'commit', '-qm', 'config'], { stdio: 'ignore' });
    s.prompt();
    repo.write('src/config.ts', code(200).replace('value10 = 10', 'value10 = 11'));
    assert.equal(s.openPr(), null);
  });

  test('large deletion blocks', () => {
    repo.write('src/big.ts', code(100));
    execFileSync('git', ['-C', repo.root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repo.root, '-c', 'user.email=t@x', '-c', 'user.name=t', 'commit', '-qm', 'big'], { stdio: 'ignore' });
    s.prompt();
    rmSync(join(repo.root, 'src', 'big.ts'));
    assert.ok(s.openPr()?.deny);
  });

  test('edits made through Bash, heredoc or subagents are caught because the tree changed', () => {
    s.prompt();
    s.preBash("cat > src/new.ts <<'EOF'\n...\nEOF");
    repo.write('src/new.ts', code(50));
    assert.ok(s.openPr()?.deny);
  });

  test('docs and lockfiles do not count, behavior docs do', () => {
    s.prompt();
    repo.write('docs/guide.md', code(200));
    repo.write('package-lock.json', code(500));
    repo.write('docs/diagram.html', code(200));
    assert.equal(s.openPr(), null);
    repo.write('.claude/agents/reviewer.md', code(40));
    assert.ok(s.openPr()?.deny);
  });

  test('completed review of the current tree releases the gate', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(60));
    assert.equal(s.launchReviewer('revise src/queue.service.ts'), null);
    assert.match(s.openPr().deny, /ainda rodando/);
    assert.equal(s.reviewerStop(), null);
    assert.equal(s.openPr(), null);
  });

  test('reviewer prompt that does not cite the changed files is denied', () => {
    s.prompt();
    repo.write('src/a.service.ts', code(40));
    repo.write('src/b.service.ts', code(40));
    const denied = s.launchReviewer('rode sed em probe.ts');
    assert.match(denied.deny, /a\.service\.ts/);
    assert.deepEqual(s.state.pending, []);
    assert.equal(s.launchReviewer('arquivos: a.service.ts'), null);
  });

  test('other subagents finishing do not count as review', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(60));
    s.launchReviewer('revise queue.service.ts');
    s.otherSubagentStop();
    assert.match(s.openPr().deny, /ainda rodando/);
  });

  test('changes during the review invalidate it', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(60));
    s.launchReviewer('revise queue.service.ts');
    repo.write('src/queue.service.ts', code(90));
    assert.match(s.reviewerStop().message, /NÃO conta/);
    assert.ok(s.openPr()?.deny);
  });

  test('edits made after a completed review require a new review', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(60));
    s.launchReviewer('queue.service.ts');
    s.reviewerStop();
    assert.equal(s.openPr(), null);
    repo.write('src/queue.service.ts', code(100));
    assert.match(s.openPr().deny, /PR bloqueado/);
    s.launchReviewer('queue.service.ts');
    s.reviewerStop();
    assert.equal(s.openPr(), null);
  });

  test('pending review survives new prompts until the reviewer stops', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(60));
    s.launchReviewer('queue.service.ts');
    s.prompt('e aí?');
    s.prompt('terminou?');
    s.prompt('??');
    assert.match(s.openPr().deny, /ainda rodando/);
    s.reviewerStop();
    assert.equal(s.openPr(), null);
  });

  test('a second attempt to open the same unreviewed PR is denied again', () => {
    s.prompt();
    repo.write('src/queue.service.ts', code(60));
    assert.ok(s.openPr()?.deny);
    assert.ok(s.openPr()?.deny);
  });

  test('"sem review" as a directive skips; mid-sentence does not', () => {
    for (const prompt of ['corrige isso sem review', 'implementa sem review.', 'faz a B (sem review)', 'ajusta, sem review']) {
      const fresh = session(repo);
      fresh.prompt(prompt);
      repo.write('src/queue.service.ts', code(60, prompt.length));
      assert.equal(fresh.openPr(), null, prompt);
    }
    const midSentence = session(createRepo());
    midSentence.prompt('esse PR entrou sem review, corrige o bug do login');
    assert.equal(midSentence.openPr(), null);
  });

  test('edits in another repo are tracked from the first Edit or leading cd', () => {
    const other = createRepo();
    s.prompt();
    s.preEdit('src/queue.service.ts');
    handle({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(other.root, 'src', 'queue.service.ts') }, cwd: repo.root }, s.state);
    other.write('src/queue.service.ts', code(70));
    assert.match(s.openPr().deny, new RegExp(other.root.split('/').pop()));

    const third = createRepo();
    const s2 = session(repo);
    s2.prompt();
    s2.preBash(`cd ${third.root} && sed -i 's/a/b/' src/queue.service.ts`);
    third.write('src/queue.service.ts', code(70));
    assert.ok(s2.openPr()?.deny);
  });

  test('opening a PR outside any git repo does nothing', () => {
    const plain = mkdtempSync(join(tmpdir(), 'gate-plain-'));
    const state = emptyState();
    handle({ hook_event_name: 'UserPromptSubmit', prompt: 'x', cwd: plain }, state);
    assert.equal(handle({ ...{ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }, cwd: plain }, state), null);
  });
});

describe('reviewer read-only guard', () => {
  const allowed = [
    'git -C /repo diff', 'git -C /repo status --short', 'git diff HEAD~1 > /tmp/review.diff', 'npx tsc --noEmit',
    'npx jest src/a.spec.ts 2>&1 | tail -20', 'npm test -- src/a.spec.ts', 'npm run lint', 'npm run format:check',
    'npx prettier --check src/utils/format.ts', 'npx eslint src/ --format json', 'ruff format --check src/', 'black --check src/',
    'git apply --check /tmp/x.patch', 'grep -rn foo src 2>/dev/null', "sed -n '1,20p' src/a.ts", 'node --test tests/',
    'mkdir -p /tmp/rv && cd /tmp/rv', 'git config --get user.email', 'git -c core.pager=cat stash list', 'git worktree list', 'git branch --show-current', 'grep -rn mv src', 'mkdir -p "$TMPDIR/rv"', 'npx tsc --noEmit > "$TMPDIR/tsc.log"', 'echo "<<END" | cat', 'aws --profile prod logs start-query --log-group-name x', '~/.claude/scripts/db-query prod "select 1"',
    "cat > /tmp/rv/probe.mjs <<'EOF'\nfs.writeFileSync('src/a.ts', 'x'); // git apply > src/a.ts\nEOF", 'echo "a > b" | cat', 'cat src/a.ts | head',
  ];
  for (const command of allowed) {
    test(`allows: ${command.split('\n')[0]}`, () => assert.equal(readOnlyViolation('Bash', { command }), null));
  }

  const denied = [
    'echo x > app.module.ts', 'echo x 1> src/a.ts', 'echo x &> src/a.ts', 'echo x >| src/a.ts', '> README.md', 'printf x | tee src/a.ts',
    "sed -i 's/a/b/' main.ts", "sed -e 's/a/b/' -i src/a.ts", "sed --in-place 's/a/b/' a.ts", "grep -rl foo src | xargs sed -i 's/a/b/'",
    'cp /tmp/x.ts main.ts', 'mv a.ts b.ts', 'rm -rf dist', 'touch src/a.ts', 'patch -p1 < /tmp/x.patch', 'find src -delete',
    'git add -A', 'git stash', 'git checkout -- src/a.ts', 'git apply /tmp/x.patch', 'git commit -m x',
    'npm install', 'npm run format', 'npm run lint:fix', 'npx prettier --write src/', 'npx eslint --fix src/', 'ruff format src/', 'black src/',
    'psql -h host', 'git -c x=y reset --hard', 'git --no-pager -C /r checkout -- src', '/bin/rm -rf src', '\\rm -rf src', 'bash -c "sed -i s/a/b/ a.ts"', "node -e \"require('fs').writeFileSync('a.ts','x')\"", 'python3 -c "open(1)"', 'npx jest -u', 'dbt run --target prod', 'npx prisma migrate deploy', 'gh pr merge 12', 'curl -o src/a.ts https://x', 'echo "<<END"\nrm -rf src', 'pulumi up', 'vault write secret/x a=1', 'aws --profile prod ssm put-parameter --name x', 'mkdir src/new',
  ];
  for (const command of denied) {
    test(`denies: ${command}`, () => assert.notEqual(readOnlyViolation('Bash', { command }), null));
  }

  test('write tools are always denied for the reviewer', () => {
    for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) assert.notEqual(readOnlyViolation(tool, {}), null);
  });

  test('guard only applies to the reviewer subagent', () => {
    const state = emptyState();
    const payload = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' }, cwd: tmpdir() };
    assert.equal(handle(payload, state), null);
    assert.match(reviewerGuard({ ...payload, agent_type: REVIEWER }).deny, /somente leitura/);
    assert.equal(handle({ ...payload, agent_type: 'general-purpose' }, state), null);
  });
});

describe('file classification', () => {
  for (const [path, expected] of [
    ['/r/src/a.ts', true], ['/r/package.json', true], ['/r/Dockerfile', true], ['/r/.claude/settings.json', true],
    ['/r/.claude/agents/x.md', true], ['/r/CLAUDE.md', true], ['/r/docs/x.md', false], ['/r/package-lock.json', false],
    ['/r/docs/report.html', false], ['/r/public/page.html', true], ['/r/dist/a.js', false], ['/r/swagger-public.json', false],
  ]) {
    test(`${path} → ${expected}`, () => assert.equal(isReviewableFile(path), expected));
  }
});

describe('hook process', () => {
  test('end to end through stdin with persisted state, via symlink', () => {
    const repo = createRepo();
    const home = mkdtempSync(join(tmpdir(), 'gate-home-'));
    const link = join(home, 'gate.mjs');
    symlinkSync(HOOK, link);
    const call = (payload) => {
      const result = spawnSync(link, [], { input: JSON.stringify({ session_id: 's-e2e', cwd: repo.root, ...payload }), encoding: 'utf-8', env: { ...process.env, HOME: home } });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim() ? JSON.parse(result.stdout) : null;
    };
    assert.equal(call({ hook_event_name: 'UserPromptSubmit', prompt: 'implementa' }), null);
    repo.write('src/queue.service.ts', code(60));
    assert.equal(call({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }).hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(call({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: REVIEWER, prompt: 'queue.service.ts' } }), null);
    assert.equal(call({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(repo.root, 'x.ts') }, agent_type: REVIEWER }).hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(call({ hook_event_name: 'SubagentStop', agent_type: REVIEWER, agent_id: 'r' }), null);
    assert.equal(call({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }), null);
    assert.ok(JSON.parse(readFileSync(join(home, '.cache', 'review-gate', 's-e2e.json'), 'utf-8')).repos[repo.root].reviewed);
  });

  test('garbage input and unknown events fail open silently', () => {
    for (const input of ['', 'not json', JSON.stringify({ hook_event_name: 'Nope', session_id: 'x' })]) {
      const result = spawnSync('node', [HOOK], { input, encoding: 'utf-8' });
      assert.equal(result.status, 0);
      assert.equal(result.stdout, '');
    }
  });

  test('render maps results to hook output formats', () => {
    assert.equal(render(null), null);
    assert.equal(render({ deny: 'r' }).hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(render({ message: 'm' }).systemMessage, 'm');
  });
});
