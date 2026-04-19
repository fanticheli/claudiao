import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../paths.js', async () => {
  return {
    CLAUDE_DIR: '',
    getTemplatesPath: () => TEMPLATES_DIR,
  };
});

let CLAUDE_DIR_OVERRIDE = '';
let TEMPLATES_DIR = '';

const importStatusline = async () => await import('../statusline.js');
const importPathsPatched = async () => await import('../paths.js');

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-statusline-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(CLAUDE_DIR_OVERRIDE, { recursive: true });
  mkdirSync(join(TEMPLATES_DIR, 'statusline'), { recursive: true });
  writeFileSync(
    join(TEMPLATES_DIR, 'statusline', 'context-bar.mjs'),
    '#!/usr/bin/env node\nprocess.exit(0)\n',
  );

  // rewrite the CLAUDE_DIR export since the mock above keeps it blank
  const paths = await importPathsPatched();
  (paths as unknown as { CLAUDE_DIR: string }).CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  vi.resetModules();
});

describe('isClaudiaoStatusline', () => {
  it('recognizes the claudiao script path', async () => {
    const { isClaudiaoStatusline } = await importStatusline();
    expect(isClaudiaoStatusline('node /home/u/.claude/statusline/context-bar.mjs')).toBe(true);
  });

  it('rejects unrelated commands', async () => {
    const { isClaudiaoStatusline } = await importStatusline();
    expect(isClaudiaoStatusline('node /home/u/my-own-statusline.js')).toBe(false);
    expect(isClaudiaoStatusline('some-other-plugin')).toBe(false);
    // different script in statusline dir is not claudiao
    expect(isClaudiaoStatusline('node /home/u/.claude/statusline/other.mjs')).toBe(false);
  });

  it('handles undefined', async () => {
    const { isClaudiaoStatusline } = await importStatusline();
    expect(isClaudiaoStatusline(undefined)).toBe(false);
  });
});

describe('copyStatuslineScript', () => {
  it('copies template to ~/.claude/statusline/ and makes it executable', async () => {
    const { copyStatuslineScript, STATUSLINE_DEST } = await importStatusline();
    const dest = copyStatuslineScript();
    expect(dest).toBe(STATUSLINE_DEST);
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, 'utf-8')).toContain('process.exit(0)');
  });

  it('throws when template is missing', async () => {
    rmSync(join(TEMPLATES_DIR, 'statusline', 'context-bar.mjs'));
    const { copyStatuslineScript } = await importStatusline();
    expect(() => copyStatuslineScript()).toThrow(/Template da statusline/);
  });
});

describe('writeStatuslineIntoSettings + removeStatuslineFromSettings', () => {
  it('adds statusLine entry to empty settings.json', async () => {
    const { buildStatuslineEntry, writeStatuslineIntoSettings } = await importStatusline();
    writeStatuslineIntoSettings(buildStatuslineEntry());
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.type).toBe('command');
    expect(settings.statusLine.command).toContain('context-bar.mjs');
  });

  it('preserves unrelated fields in settings.json', async () => {
    writeFileSync(
      join(CLAUDE_DIR_OVERRIDE, 'settings.json'),
      JSON.stringify({ effortLevel: 'high', hooks: { PreToolUse: [] } }, null, 2),
    );
    const { buildStatuslineEntry, writeStatuslineIntoSettings } = await importStatusline();
    writeStatuslineIntoSettings(buildStatuslineEntry());
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), 'utf-8'));
    expect(settings.effortLevel).toBe('high');
    expect(settings.hooks).toEqual({ PreToolUse: [] });
    expect(settings.statusLine).toBeDefined();
  });

  it('uninstall removes only claudiao-managed statusLine', async () => {
    const { buildStatuslineEntry, writeStatuslineIntoSettings, removeStatuslineFromSettings } =
      await importStatusline();
    writeStatuslineIntoSettings(buildStatuslineEntry());
    const result = removeStatuslineFromSettings();
    expect(result.removed).toBe(true);
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), 'utf-8'));
    expect(settings.statusLine).toBeUndefined();
  });

  it('uninstall preserves foreign statusLine', async () => {
    writeFileSync(
      join(CLAUDE_DIR_OVERRIDE, 'settings.json'),
      JSON.stringify(
        { statusLine: { type: 'command', command: 'node /tmp/my-custom.js' } },
        null,
        2,
      ),
    );
    const { removeStatuslineFromSettings } = await importStatusline();
    const result = removeStatuslineFromSettings();
    expect(result.removed).toBe(false);
    expect(result.reason).toMatch(/n[ãa]o foi instalada/i);
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), 'utf-8'));
    expect(settings.statusLine.command).toContain('my-custom.js');
  });

  it('uninstall is a no-op when no statusLine exists', async () => {
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify({}, null, 2));
    const { removeStatuslineFromSettings } = await importStatusline();
    const result = removeStatuslineFromSettings();
    expect(result.removed).toBe(false);
    expect(result.reason).toMatch(/nenhuma/i);
  });
});

describe('getInstalledStatusline', () => {
  it('returns null when no statusLine set', async () => {
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify({}, null, 2));
    const { getInstalledStatusline } = await importStatusline();
    expect(getInstalledStatusline()).toBeNull();
  });

  it('returns the configured entry', async () => {
    writeFileSync(
      join(CLAUDE_DIR_OVERRIDE, 'settings.json'),
      JSON.stringify({ statusLine: { type: 'command', command: 'xyz' } }, null, 2),
    );
    const { getInstalledStatusline } = await importStatusline();
    const entry = getInstalledStatusline();
    expect(entry).toEqual({ type: 'command', command: 'xyz' });
  });
});
