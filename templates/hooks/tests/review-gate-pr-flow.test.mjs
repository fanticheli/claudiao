process.env.REVIEW_GATE_MIN_LINES = '30';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle, emptyState, REVIEWER } from '../claudiao-review-gate.mjs';

const gitIn = (root, ...args) => execFileSync('git', ['-C', root, '-c', 'user.email=t@x', '-c', 'user.name=t', ...args], { stdio: 'ignore' });
const code = (lines, seed = 'v') => Array.from({ length: lines }, (_, i) => `export const ${seed}${i} = ${i};`).join('\n') + '\n';

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'gate-pr-'));
  gitIn(root, 'init', '-q', '-b', 'main');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.ts'), code(10));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'init');
  return root;
}

function session(repo) {
  const state = emptyState();
  let clock = 5_000_000;
  const fire = (payload) => handle({ cwd: repo, ...payload }, state, clock);
  return {
    state,
    prompt: (prompt = 'implementa') => fire({ hook_event_name: 'UserPromptSubmit', prompt }),
    launchReviewer: (prompt) => fire({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: REVIEWER, prompt } }),
    reviewerStop: () => fire({ hook_event_name: 'SubagentStop', agent_type: REVIEWER, agent_id: 'r1' }),
    openPr: () => fire({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }),
  };
}

describe('a PR whose work was done in an earlier session', () => {
  function repoWithCommittedBranch(lines = 200) {
    const repo = createRepo();
    gitIn(repo, 'checkout', '-qb', 'feature/earlier');
    writeFileSync(join(repo, 'src', 'big.ts'), code(lines, 'big'));
    gitIn(repo, 'add', '-A');
    gitIn(repo, 'commit', '-qm', 'feat: earlier work');
    return repo;
  }

  test('is blocked even though nothing changed in this session', () => {
    const s = session(repoWithCommittedBranch());
    s.prompt('abre o PR');
    assert.match(s.openPr().deny, /big\.ts/);
  });

  test('is released after a review that cites the files, and the review is actually registered', () => {
    const repo = repoWithCommittedBranch();
    const s = session(repo);
    s.prompt('abre o PR');
    assert.ok(s.openPr()?.deny);
    assert.equal(s.launchReviewer('revise big.ts'), null);
    assert.equal(s.state.pending.length, 1);
    assert.equal(s.reviewerStop(), null);
    assert.ok(s.state.repos[repo].reviewed);
    assert.equal(s.openPr(), null);
  });

  test('a review that ignores the branch files is rejected before it starts', () => {
    const repo = repoWithCommittedBranch();
    const s = session(repo);
    writeFileSync(join(repo, 'src', 'tiny.ts'), code(2, 'tiny'));
    s.prompt('abre o PR');
    assert.match(s.launchReviewer('revise tiny.ts').deny, /precisa citar os arquivos alterados/);
  });

  test('a review does not shrink the scope to what changed after it', () => {
    const repo = repoWithCommittedBranch();
    const s = session(repo);
    s.prompt('abre o PR');
    s.launchReviewer('revise big.ts');
    s.reviewerStop();
    writeFileSync(join(repo, 'src', 'extra.ts'), code(40, 'extra'));
    const denied = s.openPr().deny;
    assert.match(denied, /big\.ts/);
    assert.match(denied, /extra\.ts/);
  });

  test('code added after the review needs a new review', () => {
    const repo = repoWithCommittedBranch();
    const s = session(repo);
    s.prompt('abre o PR');
    s.launchReviewer('revise big.ts');
    s.reviewerStop();
    assert.equal(s.openPr(), null);
    writeFileSync(join(repo, 'src', 'later.ts'), code(80, 'later'));
    assert.match(s.openPr().deny, /later\.ts/);
  });
});
