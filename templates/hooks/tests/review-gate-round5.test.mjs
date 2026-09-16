process.env.REVIEW_GATE_MIN_LINES = '30';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle, emptyState, readOnlyViolation, REVIEWER } from '../claudiao-review-gate.mjs';

const code = (lines, seed = 'v') => Array.from({ length: lines }, (_, i) => `export const ${seed}${i} = ${i};`).join('\n') + '\n';
const gitIn = (root, ...args) => execFileSync('git', ['-C', root, '-c', 'user.email=t@x', '-c', 'user.name=t', ...args], { stdio: 'ignore' });

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'gate5-'));
  gitIn(root, 'init', '-q', '-b', 'main');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.ts'), code(10));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'init');
  return root;
}

function driver(cwd) {
  const state = emptyState();
  const fire = (payload) => handle({ cwd, ...payload }, state, 1_000_000);
  return {
    state,
    prompt: () => fire({ hook_event_name: 'UserPromptSubmit', prompt: 'implementa' }),
    launch: (prompt) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: REVIEWER, prompt } }),
    reviewerStop: () => fire({ hook_event_name: 'SubagentStop', agent_type: REVIEWER, agent_id: 'r' }),
    openPr: () => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }),
  };
}

describe('round 5 finding 1: commit followed by a branch move never escapes', () => {
  const scenarios = {
    'commit then checkout -b': (repo) => { gitIn(repo, 'commit', '-qam', 'x'); gitIn(repo, 'checkout', '-qb', 'x'); },
    'commit then switch -c': (repo) => { gitIn(repo, 'commit', '-qam', 'x'); gitIn(repo, 'switch', '-qc', 'y'); },
    'commit then checkout --detach': (repo) => { gitIn(repo, 'commit', '-qam', 'x'); gitIn(repo, 'checkout', '-q', '--detach'); },
    'switch -c then commit': (repo) => { gitIn(repo, 'switch', '-qc', 'z'); gitIn(repo, 'commit', '-qam', 'x'); },
  };
  for (const [name, move] of Object.entries(scenarios)) {
    test(name, () => {
      const repo = createRepo();
      const d = driver(repo);
      d.prompt();
      writeFileSync(join(repo, 'src', 'a.ts'), code(90));
      move(repo);
      assert.ok(d.openPr()?.deny, name);
    });
  }
});

describe('round 5 finding 2: git read flags followed by write actions are denied', () => {
  for (const command of [
    'git branch -r -d origin/main', 'git remote -v add evil http://e', 'git tag --sort=refname novatag', 'git branch -a -D x',
    'git branch --contains HEAD -m novo', 'git config --global --unset core.x', 'git config user.name "x y"', 'git config set user.name x',
    'git tag -l -d v1', 'git stash list; git stash drop',
  ]) {
    test(`denies ${command}`, () => assert.notEqual(readOnlyViolation('Bash', { command }), null));
  }
});

describe('round 5 finding 6: common reads stay allowed', () => {
  for (const command of [
    'git branch -av', 'git branch -vva', 'git branch -ra', 'git branch --points-at HEAD', 'git remote --verbose', 'git config get user.name',
    'git branch --contains HEAD', 'git tag -l "v1.*"', 'git config --get-regexp alias', 'git branch --list "feat/*"', 'git config list --global',
  ]) {
    test(`allows ${command}`, () => assert.equal(readOnlyViolation('Bash', { command }), null));
  }
});

describe('round 5 findings 3 and 4: tokenizer cannot be tricked into hiding commands', () => {
  for (const command of ["ls # don't\nrm -rf src", "$'a\\'b'; rm -rf src", 'echo $((1<<x))\nrm -rf src', 'r\\\nm -rf src', "echo x # it's fine\ngit reset --hard"]) {
    test(`denies ${JSON.stringify(command)}`, () => assert.notEqual(readOnlyViolation('Bash', { command }), null));
  }
  for (const command of ['echo ${#arr[@]}', 'grep -rn "#include" src', "ls # just listing, don't worry", 'echo $((2*3))']) {
    test(`allows ${JSON.stringify(command)}`, () => assert.equal(readOnlyViolation('Bash', { command }), null));
  }
});

describe('safety net: a review that changed files tells how to recover the pre-review content', () => {
  test('restore command in the invalidation message brings the deleted file back', () => {
    const repo = createRepo();
    const d = driver(repo);
    d.prompt();
    writeFileSync(join(repo, 'src', 'work.ts'), code(80, 'igor'));
    assert.equal(d.launch('revise work.ts'), null);
    rmSync(join(repo, 'src', 'work.ts'));
    const message = d.reviewerStop().message;
    assert.match(message, /NÃO conta/);
    const tree = message.match(/--source=([0-9a-f]{40})/)[1];
    execFileSync('git', ['-C', repo, 'restore', `--source=${tree}`, '--worktree', '--', 'src/work.ts']);
    assert.ok(existsSync(join(repo, 'src', 'work.ts')));
    assert.equal(readFileSync(join(repo, 'src', 'work.ts'), 'utf-8'), code(80, 'igor'));
  });
});
