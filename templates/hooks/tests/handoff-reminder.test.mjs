import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, CLEAR_REMINDER, MIN_TRANSCRIPT_BYTES, repositoryRoot } from '../claudiao-handoff-reminder.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-handoff-reminder.mjs');

function editEntry(filePath) {
  return JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: filePath } }] },
  });
}

function writeTranscript(dir, bytes, editedPaths = []) {
  const path = join(dir, `transcript-${Math.random().toString(36).slice(2)}.jsonl`);
  const lines = [
    JSON.stringify({ timestamp: new Date(Date.now() - 60_000).toISOString() }),
    ...editedPaths.map(editEntry),
    'x'.repeat(bytes),
  ];
  writeFileSync(path, `${lines.join('\n')}\n`);
  return path;
}

describe('handoff reminder', () => {
  let sandbox;
  let env;
  let repo;
  let otherRepo;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'handoff-hook-'));
    env = { homeDir: join(sandbox, 'home'), tempDir: join(sandbox, 'tmp') };
    mkdirSync(env.tempDir, { recursive: true });
    repo = join(sandbox, 'repo');
    otherRepo = join(sandbox, 'other');
    mkdirSync(join(repo, '.git'), { recursive: true });
    mkdirSync(join(repo, 'src'), { recursive: true });
    mkdirSync(otherRepo, { recursive: true });
    writeFileSync(join(otherRepo, '.git'), 'gitdir: elsewhere\n');
  });

  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  test('blocks a long session that edited the repo once and tells the user to clear', () => {
    const payload = { session_id: 's1', cwd: repo, transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, [join(repo, 'src', 'a.ts')]) };
    const output = decide(payload, env);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /^Crie .*session-handoff\.md/);
    assert.equal(output.systemMessage, CLEAR_REMINDER);
    assert.equal(decide(payload, env), null);
  });

  test('fires from a subfolder when the edit is elsewhere in the same repo', () => {
    const payload = { session_id: 's5', cwd: join(repo, 'src'), transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, [join(repo, 'README.md')]) };
    assert.equal(decide(payload, env)?.decision, 'block');
  });

  test('stays silent when the session only ended inside a repo it never edited', () => {
    const noEdits = { session_id: 's6', cwd: repo, transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES) };
    assert.equal(decide(noEdits, env), null);
    const editsElsewhere = { session_id: 's7', cwd: repo, transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, [join(otherRepo, 'main.ts')]) };
    assert.equal(decide(editsElsewhere, env), null);
  });

  test('fires when the session edited a linked worktree of the same repo', () => {
    const worktreeGitDir = join(repo, '.git', 'worktrees', 'feature');
    mkdirSync(worktreeGitDir, { recursive: true });
    writeFileSync(join(worktreeGitDir, 'commondir'), '../..\n');
    const worktree = join(sandbox, 'repo-feature');
    mkdirSync(join(worktree, 'src'), { recursive: true });
    writeFileSync(join(worktree, '.git'), `gitdir: ${worktreeGitDir}\n`);
    const payload = { session_id: 's8', cwd: repo, transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, [join(worktree, 'src', 'b.ts')]) };
    assert.equal(decide(payload, env)?.decision, 'block');
  });

  test('treats a .git file as a worktree root', () => {
    mkdirSync(join(otherRepo, 'pkg'), { recursive: true });
    assert.equal(repositoryRoot(join(otherRepo, 'pkg')), otherRepo);
  });

  test('stays silent on short sessions and continued stops', () => {
    const edited = [join(repo, 'src', 'a.ts')];
    const shortPayload = { session_id: 's2', cwd: repo, transcript_path: writeTranscript(sandbox, 10, edited) };
    assert.equal(decide(shortPayload, env), null);
    const longPayload = { session_id: 's3', cwd: repo, transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, edited), stop_hook_active: true };
    assert.equal(decide(longPayload, env), null);
    assert.equal(decide(null, env), null);
  });

  test('stays silent when the handoff was already written in this session', () => {
    const transcript = writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, [join(repo, 'src', 'a.ts')]);
    const memoryDir = join(env.homeDir, '.claude', 'projects', repo.replace(/[^a-zA-Z0-9]/g, '-'), 'memory');
    mkdirSync(memoryDir, { recursive: true });
    const handoff = join(memoryDir, 'session-handoff.md');
    writeFileSync(handoff, 'done');
    const now = new Date();
    utimesSync(handoff, now, now);
    assert.equal(decide({ session_id: 's4', cwd: repo, transcript_path: transcript }, env), null);
  });

  test('end to end through stdin blocks with the clear reminder', () => {
    const transcript = writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES, [join(repo, 'src', 'a.ts')]);
    const run = spawnSync('node', [HOOK], {
      input: JSON.stringify({ session_id: 'e2e', cwd: repo, transcript_path: transcript }),
      encoding: 'utf-8',
      env: { ...process.env, HOME: env.homeDir, TMPDIR: env.tempDir },
    });
    assert.equal(run.status, 0);
    const output = JSON.parse(run.stdout);
    assert.equal(output.decision, 'block');
    assert.equal(output.systemMessage, CLEAR_REMINDER);
  });

  test('end to end through stdin ignores garbage', () => {
    const garbage = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf-8' });
    assert.equal(garbage.status, 0);
    assert.equal(garbage.stdout, '');
  });
});
