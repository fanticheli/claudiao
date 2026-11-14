import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, CLEAR_REMINDER, MIN_TRANSCRIPT_BYTES } from '../claudiao-handoff-reminder.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-handoff-reminder.mjs');

function writeTranscript(dir, bytes) {
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(path, `${JSON.stringify({ timestamp: new Date(Date.now() - 60_000).toISOString() })}\n${'x'.repeat(bytes)}\n`);
  return path;
}

describe('handoff reminder', () => {
  let sandbox;
  let env;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'handoff-hook-'));
    env = { homeDir: join(sandbox, 'home'), tempDir: join(sandbox, 'tmp') };
    mkdirSync(env.tempDir, { recursive: true });
  });

  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  test('blocks a long session once and tells the user to clear', () => {
    const payload = { session_id: 's1', cwd: '/repo', transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES) };
    const output = decide(payload, env);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /^Crie .*session-handoff\.md/);
    assert.equal(output.systemMessage, CLEAR_REMINDER);
    assert.equal(decide(payload, env), null);
  });

  test('stays silent on short sessions and continued stops', () => {
    const shortPayload = { session_id: 's2', cwd: '/repo', transcript_path: writeTranscript(sandbox, 10) };
    assert.equal(decide(shortPayload, env), null);
    const longPayload = { session_id: 's3', cwd: '/repo', transcript_path: writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES), stop_hook_active: true };
    assert.equal(decide(longPayload, env), null);
    assert.equal(decide(null, env), null);
  });

  test('stays silent when the handoff was already written in this session', () => {
    const transcript = writeTranscript(sandbox, MIN_TRANSCRIPT_BYTES);
    const memoryDir = join(env.homeDir, '.claude', 'projects', '-repo', 'memory');
    mkdirSync(memoryDir, { recursive: true });
    const handoff = join(memoryDir, 'session-handoff.md');
    writeFileSync(handoff, 'done');
    const now = new Date();
    utimesSync(handoff, now, now);
    assert.equal(decide({ session_id: 's4', cwd: '/repo', transcript_path: transcript }, env), null);
  });

  test('end to end through stdin ignores garbage', () => {
    const garbage = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf-8' });
    assert.equal(garbage.status, 0);
    assert.equal(garbage.stdout, '');
  });
});
