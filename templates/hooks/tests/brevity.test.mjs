import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, BREVITY_REMINDER } from '../claudiao-brevity.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-brevity.mjs');

describe('brevity reminder', () => {
  test('injects the reminder on every user prompt', () => {
    const output = decide({ hook_event_name: 'UserPromptSubmit', prompt: 'corrige o bug da fila' });
    assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.equal(output.hookSpecificOutput.additionalContext, BREVITY_REMINDER);
  });

  test('stays silent on empty and harness-injected prompts', () => {
    assert.equal(decide({ hook_event_name: 'UserPromptSubmit', prompt: '   ' }), null);
    assert.equal(decide({ hook_event_name: 'UserPromptSubmit', prompt: '<task-notification>done</task-notification>' }), null);
    assert.equal(decide({ hook_event_name: 'UserPromptSubmit', prompt: '<command-name>/plan</command-name>' }), null);
  });

  test('ignores other events and garbage payloads', () => {
    assert.equal(decide({ hook_event_name: 'PreToolUse', tool_name: 'Bash' }), null);
    assert.equal(decide(null), null);
  });

  test('end to end through stdin', () => {
    const run = spawnSync('node', [HOOK], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'oi' }), encoding: 'utf-8' });
    assert.equal(run.status, 0);
    assert.equal(JSON.parse(run.stdout).hookSpecificOutput.additionalContext, BREVITY_REMINDER);
    const garbage = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf-8' });
    assert.equal(garbage.status, 0);
    assert.equal(garbage.stdout, '');
  });
});
