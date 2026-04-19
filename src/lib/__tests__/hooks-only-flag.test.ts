import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
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

const importHooks = async () => await import('../hooks.js');

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-only-flag-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(CLAUDE_DIR_OVERRIDE, { recursive: true });
  mkdirSync(join(TEMPLATES_DIR, 'hooks'), { recursive: true });
  for (const name of [
    'claudiao-security-reminder.mjs',
    'claudiao-ui-reminder.mjs',
    'claudiao-migration-reminder.mjs',
    'claudiao-commit-reminder.mjs',
    'claudiao-pr-reminder.mjs',
  ]) {
    writeFileSync(join(TEMPLATES_DIR, 'hooks', name), '#!/usr/bin/env node\n');
  }
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  vi.resetModules();
});

describe('parseOnlyFlag', () => {
  it('parses a single category', async () => {
    const { parseOnlyFlag } = await importHooks();
    const parsed = parseOnlyFlag('ui');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.categories.map((c) => c.id)).toEqual(['ui']);
  });

  it('parses multiple categories in order', async () => {
    const { parseOnlyFlag } = await importHooks();
    const parsed = parseOnlyFlag('ui,migration');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.categories.map((c) => c.id)).toEqual(['ui', 'migration']);
  });

  it('tolerates whitespace and mixed case', async () => {
    const { parseOnlyFlag } = await importHooks();
    const parsed = parseOnlyFlag(' UI , Migration ');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.categories.map((c) => c.id)).toEqual(['ui', 'migration']);
  });

  it('de-dupes repeated categories', async () => {
    const { parseOnlyFlag } = await importHooks();
    const parsed = parseOnlyFlag('ui,ui,migration');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.categories.map((c) => c.id)).toEqual(['ui', 'migration']);
  });

  it('accepts all five categories', async () => {
    const { parseOnlyFlag } = await importHooks();
    const parsed = parseOnlyFlag('security,ui,migration,commit,pr');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.categories.map((c) => c.id)).toEqual(['security', 'ui', 'migration', 'commit', 'pr']);
  });

  it('reports unknown ids', async () => {
    const { parseOnlyFlag } = await importHooks();
    const parsed = parseOnlyFlag('bogus');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.invalid).toEqual(['bogus']);
  });
});

describe('mergeHooksIntoSettings — multi-category regression', () => {
  it('preserves every category when installing multiple at once (the first-item bug)', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const ui = HOOK_CATEGORIES.find((c) => c.id === 'ui')!;
    const migration = HOOK_CATEGORIES.find((c) => c.id === 'migration')!;

    writeSettings(mergeHooksIntoSettings([ui, migration]));

    const saved = readSettings();
    const commands = (saved.hooks?.PreToolUse ?? []).flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('claudiao-ui-reminder.mjs'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-migration-reminder.mjs'))).toBe(true);
  });

  it('order does not matter — migration,ui also installs both', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const ui = HOOK_CATEGORIES.find((c) => c.id === 'ui')!;
    const migration = HOOK_CATEGORIES.find((c) => c.id === 'migration')!;

    writeSettings(mergeHooksIntoSettings([migration, ui]));

    const saved = readSettings();
    const commands = (saved.hooks?.PreToolUse ?? []).flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('claudiao-ui-reminder.mjs'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-migration-reminder.mjs'))).toBe(true);
  });

  it('installs all categories at once without loss', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();

    writeSettings(mergeHooksIntoSettings(HOOK_CATEGORIES));

    const saved = readSettings();
    const commands = [
      ...(saved.hooks?.PreToolUse ?? []).flatMap((m) => m.hooks.map((h) => h.command)),
      ...(saved.hooks?.Stop ?? []).flatMap((m) => m.hooks.map((h) => h.command)),
    ];
    for (const cat of HOOK_CATEGORIES) {
      expect(commands.some((c) => c.includes(cat.script))).toBe(true);
    }
  });

  it('preserves a pre-existing non-claudiao hook when installing multiple categories', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [{ type: 'command', command: '/path/to/gsd-guard.js', timeout: 5 }],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const ui = HOOK_CATEGORIES.find((c) => c.id === 'ui')!;
    const migration = HOOK_CATEGORIES.find((c) => c.id === 'migration')!;

    writeSettings(mergeHooksIntoSettings([ui, migration]));

    const saved = readSettings();
    const commands = (saved.hooks?.PreToolUse ?? []).flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('gsd-guard.js'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-ui-reminder.mjs'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-migration-reminder.mjs'))).toBe(true);
  });
});
