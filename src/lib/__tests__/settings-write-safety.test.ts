import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// IMPORTANT: mock the paths module BEFORE importing hooks/statusline
vi.mock('../paths.js', async () => {
  return {
    CLAUDE_DIR: '', // overridden per test via paths patch below
    getTemplatesPath: () => TEMPLATES_DIR,
  };
});

let CLAUDE_DIR_OVERRIDE = '';
let TEMPLATES_DIR = '';

const importHooks = async () => await import('../hooks.js');
const importStatusline = async () => await import('../statusline.js');

let tmpRoot: string;
let settingsFile: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-settings-safety-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(CLAUDE_DIR_OVERRIDE, { recursive: true });
  mkdirSync(join(TEMPLATES_DIR, 'hooks'), { recursive: true });
  settingsFile = join(CLAUDE_DIR_OVERRIDE, 'settings.json');

  const paths = await import('../paths.js');
  (paths as unknown as { CLAUDE_DIR: string }).CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  vi.resetModules();
});

const MALFORMED = '{ "hooks": { "PreToolUse": [ TRUNCATED';

describe('readSettingsForWrite', () => {
  it('returns {} when settings.json does not exist', async () => {
    const { readSettingsForWrite } = await importHooks();
    expect(readSettingsForWrite()).toEqual({});
  });

  it('returns the parsed object when settings.json is valid', async () => {
    writeFileSync(settingsFile, JSON.stringify({ env: { FOO: 'bar' } }));
    const { readSettingsForWrite } = await importHooks();
    expect(readSettingsForWrite()).toEqual({ env: { FOO: 'bar' } });
  });

  it('throws MalformedSettingsError when settings.json exists but is invalid JSON', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { readSettingsForWrite, MalformedSettingsError } = await importHooks();
    expect(() => readSettingsForWrite()).toThrow(MalformedSettingsError);
  });
});

describe('write flows refuse to clobber a malformed settings.json', () => {
  it('mergeHooksIntoSettings throws and leaves the file byte-identical', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { mergeHooksIntoSettings, HOOK_CATEGORIES, MalformedSettingsError } = await importHooks();
    const security = HOOK_CATEGORIES.find((c) => c.id === 'security')!;

    expect(() => mergeHooksIntoSettings([security])).toThrow(MalformedSettingsError);
    expect(readFileSync(settingsFile, 'utf-8')).toBe(MALFORMED);
  });

  it('removeClaudiaoHooks throws and leaves the file byte-identical', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { removeClaudiaoHooks, MalformedSettingsError } = await importHooks();

    expect(() => removeClaudiaoHooks()).toThrow(MalformedSettingsError);
    expect(readFileSync(settingsFile, 'utf-8')).toBe(MALFORMED);
  });

  it('migrateClaudiaoHookMatchers throws and leaves the file byte-identical', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { migrateClaudiaoHookMatchers, MalformedSettingsError } = await importHooks();

    expect(() => migrateClaudiaoHookMatchers()).toThrow(MalformedSettingsError);
    expect(readFileSync(settingsFile, 'utf-8')).toBe(MALFORMED);
  });

  it('writeStatuslineIntoSettings throws and leaves the file byte-identical', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { writeStatuslineIntoSettings } = await importStatusline();
    const { MalformedSettingsError } = await importHooks();

    expect(() => writeStatuslineIntoSettings({ type: 'command', command: 'node x.mjs' })).toThrow(
      MalformedSettingsError,
    );
    expect(readFileSync(settingsFile, 'utf-8')).toBe(MALFORMED);
  });

  it('removeStatuslineFromSettings throws and leaves the file byte-identical', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { removeStatuslineFromSettings } = await importStatusline();
    const { MalformedSettingsError } = await importHooks();

    expect(() => removeStatuslineFromSettings()).toThrow(MalformedSettingsError);
    expect(readFileSync(settingsFile, 'utf-8')).toBe(MALFORMED);
  });
});

describe('read-only flows stay lenient on malformed settings.json', () => {
  it('readSettings still returns {} (listInstalledHooks must not crash)', async () => {
    writeFileSync(settingsFile, MALFORMED);
    const { readSettings, listInstalledHooks } = await importHooks();
    expect(readSettings()).toEqual({});
    expect(listInstalledHooks()).toEqual([]);
  });
});

describe('writeSettings atomicity', () => {
  it('writes valid JSON and leaves no temp files behind', async () => {
    const { writeSettings } = await importHooks();
    writeSettings({ env: { FOO: 'bar' } });

    const files = readdirSync(CLAUDE_DIR_OVERRIDE);
    expect(files).toEqual(['settings.json']);
    expect(JSON.parse(readFileSync(settingsFile, 'utf-8'))).toEqual({ env: { FOO: 'bar' } });
  });

  it.skipIf(process.platform === 'win32')(
    'replaces the file via rename, not in-place write (read-only file can still be swapped)',
    async () => {
      // A direct writeFileSync on a 0o444 file throws EACCES; an atomic
      // tmp-write + rename succeeds because rename only needs dir perms.
      writeFileSync(settingsFile, JSON.stringify({ old: true }));
      chmodSync(settingsFile, 0o444);
      const { writeSettings } = await importHooks();

      expect(() => writeSettings({ a: 1 })).not.toThrow();
      expect(JSON.parse(readFileSync(settingsFile, 'utf-8'))).toEqual({ a: 1 });
    },
  );
});
