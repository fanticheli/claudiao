import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attributionViolation } from '../claudiao-no-attribution.mjs';

const TRAILER = ['https://claude', 'ai/code/session_01XZ'].join('.');
const SESSION_TRAILER = ['Claude', 'Session: abc'].join('-');
const bash = (command, cwd) => ({ tool_name: 'Bash', tool_input: { command }, cwd });

describe('standards-no-attribution: inline text', () => {
  const denied = [
    bash(`gh pr create --title "feat(x): y" --body "O que foi feito\n\n${TRAILER}"`),
    bash('gh pr comment 12 --body "🤖 Generated with [Claude Code](https://claude.com/claude-code)"'),
    bash('gh api repos/o/r/issues/1/comments -f body="Co-Authored-By: Claude <noreply@anthropic.com>"'),
    bash(`git tag -a v1 -m "release\n\n${SESSION_TRAILER}"`),
    bash(`gh pr create --title x --body "$(cat <<'EOF'\n## Como testar\nnpx jest src/auth | grep -v PASS\n\n${SESSION_TRAILER}\nEOF\n)"`),
    bash(`git commit -m "fix(a): b; grep bar\n${TRAILER}"`),
    { tool_name: 'mcp__atlassian__addCommentToJiraIssue', tool_input: { issueIdOrKey: 'GPT-1', commentBody: `Resolvido.\n${TRAILER}` } },
    { tool_name: 'mcp__atlassian__createJiraIssue', tool_input: { summary: 'bug', description: 'Generated with Claude Code' } },
    { tool_name: 'mcp__claude_ai_Slack__slack_send_message', tool_input: { channel_id: 'C1', message: `status\n${TRAILER}` } },
  ];
  for (const payload of denied) {
    test(`denies ${payload.tool_name} ${String(payload.tool_input.command ?? '').slice(0, 40)}`, () => assert.notEqual(attributionViolation(payload), null));
  }

  const allowed = [
    bash('gh pr create --title "feat(x): y" --body "O que foi feito"'),
    bash('grep -rn "Co-Authored-By: Claude" .'),
    bash(`echo ${TRAILER}`),
    bash('gh pr create --body "Co-authored-by: Maria <maria@example.com>"'),
    bash('gh pr view 12 --json body | grep -i claude.ai/code'),
    bash('gh pr list --search "Co-Authored-By: Claude"'),
    bash(`gh api repos/o/r/pulls/1 --jq .body | grep -c ${SESSION_TRAILER.split(' ')[0]}`),
    bash('git merge-base main HEAD && git log --format=%B | grep -c claude.ai/code'),
    bash(`git log -1 --format=%B | grep -v ${SESSION_TRAILER.split(' ')[0]} | git commit --amend -F -`),
    { tool_name: 'mcp__atlassian__searchJiraIssuesUsingJql', tool_input: { jql: 'text ~ "claude.ai/code"' } },
    { tool_name: 'mcp__claude_ai_Slack__slack_send_message', tool_input: { channel_id: 'C1', message: 'deploy feito' } },
  ];
  for (const payload of allowed) {
    test(`allows ${payload.tool_name} ${String(payload.tool_input.command ?? payload.tool_input.jql ?? payload.tool_input.message).slice(0, 40)}`, () => assert.equal(attributionViolation(payload), null));
  }
});

describe('standards-no-attribution: body from files and stdin', () => {
  const directory = mkdtempSync(join(tmpdir(), 'attr-'));
  mkdirSync(join(directory, 'repo'));
  writeFileSync(join(directory, 'body.md'), `## O que foi feito\n\n${TRAILER}\n`);
  writeFileSync(join(directory, 'repo', 'msg.txt'), `fix(a): b\n\n${SESSION_TRAILER}\n`);
  writeFileSync(join(directory, 'clean.md'), '## O que foi feito\n');

  const denied = [
    'gh pr create --title "feat(x): y" --body-file body.md',
    'gh issue create -t x -F body.md',
    'gh pr edit 12 --body-file - < body.md',
    'cat body.md | gh pr edit 12 --body-file -',
    'git commit --file=repo/msg.txt',
    'git commit --file repo/msg.txt',
    'cd repo && git commit -F msg.txt',
    'git -C repo commit -F msg.txt',
    'git commit -m "$(cat repo/msg.txt)"',
    'gh api repos/o/r/issues/1/comments -F body=@body.md',
  ];
  for (const command of denied) {
    test(`denies ${command}`, () => assert.notEqual(attributionViolation(bash(command, directory)), null));
  }

  test('clean body file passes', () => {
    assert.equal(attributionViolation(bash('gh pr create --body-file clean.md', directory)), null);
  });

  test('reading a file with attribution without publishing passes', () => {
    assert.equal(attributionViolation(bash('cat body.md | wc -l', directory)), null);
  });
});
