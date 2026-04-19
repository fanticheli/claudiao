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
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-matcher-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(CLAUDE_DIR_OVERRIDE, { recursive: true });
  mkdirSync(join(TEMPLATES_DIR, 'hooks'), { recursive: true });
  for (const name of [
    'claudiao-security-reminder.mjs',
    'claudiao-ui-reminder.mjs',
    'claudiao-migration-reminder.mjs',
    'claudiao-commit-reminder.mjs',
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

describe('migration hook matcher', () => {
  it('registers with Write|Edit on a fresh install', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const migration = HOOK_CATEGORIES.find((c) => c.id === 'migration')!;
    expect(migration.matcher).toBe('Write|Edit');

    writeSettings(mergeHooksIntoSettings([migration]));

    const saved = readSettings();
    const entry = saved.hooks!.PreToolUse!.find((m) =>
      m.hooks.some((h) => h.command.includes('claudiao-migration-reminder.mjs')),
    );
    expect(entry?.matcher).toBe('Write|Edit');
  });
});

describe('migrateClaudiaoHookMatchers — v1.2.0 migration regression', () => {
  it('moves a 1.2.0 migration entry from Write to Write|Edit', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    // Simulate a 1.2.0 install: migration registered under bare 'Write'
    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write',
            hooks: [
              {
                type: 'command',
                command: join(CLAUDE_DIR_OVERRIDE, 'hooks', 'claudiao-migration-reminder.mjs'),
                timeout: 5,
              },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { migrateClaudiaoHookMatchers, readSettings } = await importHooks();
    const migrated = migrateClaudiaoHookMatchers();
    expect(migrated).toBe(1);

    const saved = readSettings();
    const preToolUse = saved.hooks!.PreToolUse!;
    // Old 'Write' bucket should be gone (it only held the migration hook)
    expect(preToolUse.find((m) => m.matcher === 'Write')).toBeUndefined();
    // New 'Write|Edit' bucket should now hold the migration hook
    const canonical = preToolUse.find((m) => m.matcher === 'Write|Edit');
    expect(canonical).toBeDefined();
    expect(canonical!.hooks.some((h) => h.command.includes('claudiao-migration-reminder.mjs'))).toBe(true);
  });

  it('does NOT touch non-claudiao hooks that also use matcher Write', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write',
            hooks: [
              { type: 'command', command: '/path/to/user-own-hook.js', timeout: 5 },
              {
                type: 'command',
                command: join(CLAUDE_DIR_OVERRIDE, 'hooks', 'claudiao-migration-reminder.mjs'),
                timeout: 5,
              },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { migrateClaudiaoHookMatchers, readSettings } = await importHooks();
    migrateClaudiaoHookMatchers();

    const saved = readSettings();
    const preToolUse = saved.hooks!.PreToolUse!;

    const writeBucket = preToolUse.find((m) => m.matcher === 'Write');
    expect(writeBucket).toBeDefined();
    expect(writeBucket!.hooks).toHaveLength(1);
    expect(writeBucket!.hooks[0].command).toBe('/path/to/user-own-hook.js');

    const canonical = preToolUse.find((m) => m.matcher === 'Write|Edit');
    expect(canonical!.hooks.some((h) => h.command.includes('claudiao-migration-reminder.mjs'))).toBe(true);
  });

  it('is idempotent — running twice on an already-migrated settings.json is a no-op', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, migrateClaudiaoHookMatchers } =
      await importHooks();
    const migration = HOOK_CATEGORIES.find((c) => c.id === 'migration')!;
    writeSettings(mergeHooksIntoSettings([migration]));

    expect(migrateClaudiaoHookMatchers()).toBe(0);
    expect(migrateClaudiaoHookMatchers()).toBe(0);
  });

  it('returns 0 when there are no claudiao hooks installed', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify({}, null, 2));

    const { migrateClaudiaoHookMatchers } = await importHooks();
    expect(migrateClaudiaoHookMatchers()).toBe(0);
  });
});
