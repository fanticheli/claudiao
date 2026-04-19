import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// IMPORTANT: mock the paths module BEFORE importing hooks
vi.mock('../paths.js', async () => {
  return {
    CLAUDE_DIR: '', // overridden per test via setClaudeDir
    getTemplatesPath: () => TEMPLATES_DIR,
  };
});

let CLAUDE_DIR_OVERRIDE = '';
let TEMPLATES_DIR = '';

// Re-import hooks after mocks
const importHooks = async () => await import('../hooks.js');

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-hooks-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(CLAUDE_DIR_OVERRIDE, { recursive: true });
  mkdirSync(join(TEMPLATES_DIR, 'hooks'), { recursive: true });

  // Write fake hook scripts (new .mjs format shipped in 1.2+)
  for (const name of [
    'claudiao-security-reminder.mjs',
    'claudiao-ui-reminder.mjs',
    'claudiao-migration-reminder.mjs',
    'claudiao-commit-reminder.mjs',
    'claudiao-pr-reminder.mjs',
  ]) {
    writeFileSync(join(TEMPLATES_DIR, 'hooks', name), '#!/usr/bin/env node\nprocess.exit(0)\n');
  }
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  vi.resetModules();
});

describe('isClaudiaoHook', () => {
  it('identifies claudiao hooks by filename pattern', async () => {
    const { isClaudiaoHook } = await importHooks();
    expect(isClaudiaoHook('/home/x/.claude/hooks/claudiao-security-reminder.mjs')).toBe(true);
    // legacy .sh still recognized so uninstall can clean up pre-1.2 entries
    expect(isClaudiaoHook('/home/x/.claude/hooks/claudiao-security-reminder.sh')).toBe(true);
    expect(isClaudiaoHook('/home/x/.claude/hooks/gsd-context-monitor.js')).toBe(false);
    expect(isClaudiaoHook('node /other/claudiao-thing.js')).toBe(false);
  });
});

describe('mergeHooksIntoSettings', () => {
  it('creates hooks section when settings.json is empty', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const security = HOOK_CATEGORIES.find((c) => c.id === 'security')!;

    const merged = mergeHooksIntoSettings([security]);
    writeSettings(merged);

    const saved = readSettings();
    expect(saved.hooks?.PreToolUse).toBeDefined();
    expect(saved.hooks!.PreToolUse![0].matcher).toBe('Write|Edit');
    expect(saved.hooks!.PreToolUse![0].hooks[0].command).toContain('claudiao-security-reminder.mjs');
  });

  it('migrates legacy .sh entries to .mjs on merge (no duplication)', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    // Simulate settings from a pre-1.2 install
    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [
              { type: 'command', command: join(CLAUDE_DIR_OVERRIDE, 'hooks', 'claudiao-security-reminder.sh'), timeout: 5 },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const security = HOOK_CATEGORIES.find((c) => c.id === 'security')!;

    writeSettings(mergeHooksIntoSettings([security]));

    const saved = readSettings();
    const all = saved.hooks!.PreToolUse!.flatMap((m) => m.hooks);
    expect(all).toHaveLength(1);
    expect(all[0].command).toContain('.mjs');
    expect(all[0].command).not.toContain('.sh');
  });

  it('preserves existing non-claudiao hooks when merging', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    // Pre-populate settings with a gsd-like hook
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
    const security = HOOK_CATEGORIES.find((c) => c.id === 'security')!;

    const merged = mergeHooksIntoSettings([security]);
    writeSettings(merged);

    const saved = readSettings();
    // Mesmo matcher "Write|Edit" deve ter 2 hooks agora (gsd + claudiao)
    const preToolUse = saved.hooks!.PreToolUse!;
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse[0].hooks).toHaveLength(2);
    expect(preToolUse[0].hooks.some((h) => h.command.includes('gsd-guard'))).toBe(true);
    expect(preToolUse[0].hooks.some((h) => h.command.includes('claudiao-security'))).toBe(true);
  });

  it('is idempotent — running twice does not duplicate hooks', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const ui = HOOK_CATEGORIES.find((c) => c.id === 'ui')!;

    writeSettings(mergeHooksIntoSettings([ui]));
    writeSettings(mergeHooksIntoSettings([ui])); // segunda vez

    const saved = readSettings();
    const claudiaoHooks = saved.hooks!.PreToolUse!.flatMap((m) =>
      m.hooks.filter((h) => h.command.includes('claudiao-ui')),
    );
    expect(claudiaoHooks).toHaveLength(1);
  });

  it('installs pr category under Stop event without matcher field', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const pr = HOOK_CATEGORIES.find((c) => c.id === 'pr')!;

    writeSettings(mergeHooksIntoSettings([pr]));

    const saved = readSettings();
    expect(saved.hooks?.Stop).toBeDefined();
    const stopEntries = saved.hooks!.Stop!;
    expect(stopEntries).toHaveLength(1);
    // Stop hooks don't carry a `matcher` field per Claude Code spec
    expect(stopEntries[0].matcher).toBeUndefined();
    expect(stopEntries[0].hooks[0].command).toContain('claudiao-pr-reminder.mjs');
  });

  it('preserves Stop entries from other tools when installing pr', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    // Seed settings with a third-party Stop hook (e.g. superpowers plugin)
    const initial = {
      hooks: {
        Stop: [
          {
            hooks: [{ type: 'command', command: '/path/to/other-stop-hook.js', timeout: 5 }],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings } = await importHooks();
    const pr = HOOK_CATEGORIES.find((c) => c.id === 'pr')!;

    writeSettings(mergeHooksIntoSettings([pr]));

    const saved = readSettings();
    const commands = (saved.hooks?.Stop ?? []).flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('other-stop-hook.js'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-pr-reminder.mjs'))).toBe(true);
  });
});

describe('removeClaudiaoHooks with Stop event', () => {
  it('removes pr hook from Stop event and preserves other Stop hooks', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const initial = {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: 'command', command: '/path/to/other-stop-hook.js', timeout: 5 },
              {
                type: 'command',
                command: join(CLAUDE_DIR_OVERRIDE, 'hooks', 'claudiao-pr-reminder.mjs'),
                timeout: 5,
              },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { removeClaudiaoHooks, readSettings } = await importHooks();
    const { removedCount, categoriesRemoved } = removeClaudiaoHooks(['pr']);

    expect(removedCount).toBe(1);
    expect(categoriesRemoved).toContain('pr');

    const saved = readSettings();
    const commands = (saved.hooks?.Stop ?? []).flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('other-stop-hook.js'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-pr-reminder'))).toBe(false);
  });
});

describe('removeClaudiaoHooks', () => {
  it('removes only claudiao hooks, preserves others', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [
              { type: 'command', command: '/path/to/gsd-guard.js', timeout: 5 },
              { type: 'command', command: '/home/u/.claude/hooks/claudiao-security-reminder.sh', timeout: 5 },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { removeClaudiaoHooks, readSettings } = await importHooks();
    const { removedCount } = removeClaudiaoHooks();

    expect(removedCount).toBe(1);
    const saved = readSettings();
    expect(saved.hooks!.PreToolUse![0].hooks).toHaveLength(1);
    expect(saved.hooks!.PreToolUse![0].hooks[0].command).toContain('gsd-guard');
  });

  it('cleans up empty event arrays after removal', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [
              { type: 'command', command: '/home/u/.claude/hooks/claudiao-security-reminder.sh', timeout: 5 },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { removeClaudiaoHooks, readSettings } = await importHooks();
    const { removedCount, categoriesRemoved } = removeClaudiaoHooks();

    expect(removedCount).toBe(1);
    expect(categoriesRemoved).toContain('security');

    const saved = readSettings();
    expect(saved.hooks).toBeUndefined();
  });

  it('returns 0 when no claudiao hooks exist', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify({}, null, 2));

    const { removeClaudiaoHooks } = await importHooks();
    const { removedCount } = removeClaudiaoHooks();

    expect(removedCount).toBe(0);
  });
});

describe('listInstalledHooks', () => {
  it('returns empty array when no settings.json exists', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { listInstalledHooks } = await importHooks();
    expect(listInstalledHooks()).toEqual([]);
  });

  it('lists claudiao hooks with correct category inference', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const initial = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Edit',
            hooks: [
              { type: 'command', command: '/home/u/.claude/hooks/claudiao-security-reminder.sh', timeout: 5 },
              { type: 'command', command: '/home/u/.claude/hooks/claudiao-ui-reminder.sh', timeout: 5 },
            ],
          },
        ],
      },
    };
    writeFileSync(join(CLAUDE_DIR_OVERRIDE, 'settings.json'), JSON.stringify(initial, null, 2));

    const { listInstalledHooks } = await importHooks();
    const installed = listInstalledHooks();

    expect(installed).toHaveLength(2);
    expect(installed.find((h) => h.category === 'security')).toBeDefined();
    expect(installed.find((h) => h.category === 'ui')).toBeDefined();
  });
});
