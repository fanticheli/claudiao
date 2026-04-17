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

  // Write fake hook scripts
  for (const name of [
    'claudiao-security-reminder.sh',
    'claudiao-ui-reminder.sh',
    'claudiao-migration-reminder.sh',
    'claudiao-commit-reminder.sh',
  ]) {
    writeFileSync(join(TEMPLATES_DIR, 'hooks', name), '#!/usr/bin/env bash\nexit 0\n');
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
    expect(isClaudiaoHook('/home/x/.claude/hooks/claudiao-security-reminder.sh')).toBe(true);
    expect(isClaudiaoHook('/home/x/.claude/hooks/gsd-context-monitor.js')).toBe(false);
    expect(isClaudiaoHook('node /other/claudiao-thing.js')).toBe(false); // must end with .sh
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
    expect(saved.hooks!.PreToolUse![0].hooks[0].command).toContain('claudiao-security-reminder.sh');
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
