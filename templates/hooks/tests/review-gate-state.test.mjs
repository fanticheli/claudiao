process.env.REVIEW_GATE_MIN_LINES = '30';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeState, handle, emptyState, repoRoot } from '../claudiao-review-gate.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'claudiao-review-gate.mjs');
const gitIn = (root, ...args) => execFileSync('git', ['-C', root, '-c', 'user.email=t@x', '-c', 'user.name=t', ...args], { stdio: 'ignore' });

describe('state from older versions never disables the gate silently', () => {
  test('pending null, missing fields and wrong types are normalized', () => {
    const state = normalizeState({ repos: { '/r': { baseline: 'x' } }, pending: null, rounds: '2', unavailable: [], extra: 1 });
    assert.deepEqual(state.pending, []);
    assert.equal(state.rounds, 0);
    assert.deepEqual(state.unavailable, {});
    assert.deepEqual(state.failedThisTurn, {});
    assert.deepEqual(state.repos, { '/r': { baseline: 'x' } });
    assert.equal(state.extra, undefined);
  });

  test('malformed pending entries are dropped', () => {
    assert.deepEqual(normalizeState({ pending: [null, { trees: {} }, { trees: {}, launchedAt: 5 }] }).pending, [{ trees: {}, launchedAt: 5 }]);
  });

  test('legacy state on disk with pending null still rebaselines on prompt and blocks on stop', () => {
    const repo = mkdtempSync(join(tmpdir(), 'gate-legacy-'));
    gitIn(repo, 'init', '-q');
    mkdirSync(join(repo, 'src'));
    writeFileSync(join(repo, 'src', 'a.ts'), 'x\n');
    gitIn(repo, 'add', '-A');
    gitIn(repo, 'commit', '-qm', 'i');
    const home = mkdtempSync(join(tmpdir(), 'gate-legacy-home-'));
    mkdirSync(join(home, '.cache', 'review-gate'), { recursive: true });
    writeFileSync(join(home, '.cache', 'review-gate', 'legacy.json'), JSON.stringify({ repos: {}, pending: null, rounds: 0, skip: false, blockedKey: null }));
    const call = (payload) => {
      const result = spawnSync('node', [HOOK], { input: JSON.stringify({ session_id: 'legacy', cwd: repo, ...payload }), encoding: 'utf-8', env: { ...process.env, HOME: home } });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim() ? JSON.parse(result.stdout) : null;
    };
    call({ hook_event_name: 'UserPromptSubmit', prompt: 'implementa' });
    writeFileSync(join(repo, 'src', 'a.ts'), 'y\n'.repeat(80));
    assert.equal(call({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } })?.hookSpecificOutput?.permissionDecision, 'deny');
  });
});

describe('internal errors when opening a PR are visible', () => {
  test('a handler exception becomes a system message, not silence', () => {
    const state = emptyState();
    state.pending = 'broken';
    const result = handle({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }, state);
    assert.match(result.message, /Erro interno/);
  });
});

describe('tooling directories that happen to be git repos are not tracked', () => {
  test('a repo under .nvm is ignored', () => {
    const root = join(mkdtempSync(join(tmpdir(), 'gate-tool-')), '.nvm');
    mkdirSync(root, { recursive: true });
    gitIn(root, 'init', '-q');
    assert.equal(repoRoot(join(root, 'versions')), null);
  });
});
