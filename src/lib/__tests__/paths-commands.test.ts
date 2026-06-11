import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock homedir BEFORE importing paths so CLAUDE_DIR/CONFIG_FILE land in a
// tmp sandbox — lets us exercise the external > bundled cascade without
// touching the real ~/.claude.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => HOME_OVERRIDE,
  };
});

let HOME_OVERRIDE = '';
let tmpRoot: string;

const importPaths = async () => await import('../paths.js');

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-paths-commands-'));
  HOME_OVERRIDE = join(tmpRoot, 'home');
  mkdirSync(join(HOME_OVERRIDE, '.claude'), { recursive: true });
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  vi.resetModules();
});

// getExternalRepoPath only honors repoPath when the repo has an agents/
// dir — so every "valid external repo" fixture needs one.
function writeConfig(repoPath: string): void {
  mkdirSync(join(repoPath, 'agents'), { recursive: true });
  writeFileSync(
    join(HOME_OVERRIDE, '.claude', '.claudiao.json'),
    JSON.stringify({ repoPath }),
  );
}

describe('CLAUDE_COMMANDS_DIR', () => {
  it('points to ~/.claude/commands', async () => {
    const { CLAUDE_COMMANDS_DIR, CLAUDE_DIR } = await importPaths();
    expect(CLAUDE_COMMANDS_DIR).toBe(join(CLAUDE_DIR, 'commands'));
  });
});

describe('getCommandsSource cascade', () => {
  it('prefers the external repo commands/ dir when it exists', async () => {
    const repo = join(tmpRoot, 'repo');
    mkdirSync(join(repo, 'commands'), { recursive: true });
    writeConfig(repo);

    const { getCommandsSource } = await importPaths();
    expect(getCommandsSource()).toBe(join(repo, 'commands'));
  });

  it('falls back past an external repo without commands/ dir', async () => {
    const repo = join(tmpRoot, 'repo');
    mkdirSync(repo, { recursive: true }); // no commands/ inside
    writeConfig(repo);

    const { getCommandsSource, getTemplatesPath } = await importPaths();
    const bundled = join(getTemplatesPath(), 'commands');
    const expected = existsSync(bundled) ? bundled : null;
    expect(getCommandsSource()).toBe(expected);
  });

  it('uses bundled templates (or null) when no external repo is configured', async () => {
    const { getCommandsSource, getTemplatesPath } = await importPaths();
    const bundled = join(getTemplatesPath(), 'commands');
    const expected = existsSync(bundled) ? bundled : null;
    expect(getCommandsSource()).toBe(expected);
  });
});

describe('getCommandsSavePath', () => {
  it('returns external repo commands/ when configured', async () => {
    const repo = join(tmpRoot, 'repo');
    mkdirSync(repo, { recursive: true });
    writeConfig(repo);

    const { getCommandsSavePath } = await importPaths();
    expect(getCommandsSavePath()).toBe(join(repo, 'commands'));
  });

  it('returns bundled templates commands/ when no external repo', async () => {
    const { getCommandsSavePath, getTemplatesPath } = await importPaths();
    expect(getCommandsSavePath()).toBe(join(getTemplatesPath(), 'commands'));
  });
});
