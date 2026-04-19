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
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-uninstall-only-'));
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

describe('removeClaudiaoHooks — selective removal via --only', () => {
  async function installAll() {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;
    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings } = await importHooks();
    writeSettings(mergeHooksIntoSettings(HOOK_CATEGORIES));
  }

  it('removes only the requested category when called with --only ui', async () => {
    await installAll();
    const { removeClaudiaoHooks, listInstalledHooks } = await importHooks();

    const result = removeClaudiaoHooks(['ui']);
    expect(result.removedCount).toBe(1);
    expect(result.categoriesRemoved).toEqual(['ui']);

    const remaining = listInstalledHooks();
    const ids = remaining.map((h) => h.category).sort();
    expect(ids).toEqual(['commit', 'migration', 'security']);
  });

  it('removes multiple categories when called with --only ui,migration', async () => {
    await installAll();
    const { removeClaudiaoHooks, listInstalledHooks } = await importHooks();

    const result = removeClaudiaoHooks(['ui', 'migration']);
    expect(result.removedCount).toBe(2);
    expect(result.categoriesRemoved.sort()).toEqual(['migration', 'ui']);

    const remaining = listInstalledHooks();
    const ids = remaining.map((h) => h.category).sort();
    expect(ids).toEqual(['commit', 'security']);
  });

  it('preserves unrelated (non-claudiao) hooks during selective removal', async () => {
    const paths = await import('../paths.js');
    // @ts-expect-error test override
    paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;

    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, readSettings, removeClaudiaoHooks } =
      await importHooks();

    // Seed a user hook first, then install all claudiao hooks on top
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
    writeSettings(mergeHooksIntoSettings(HOOK_CATEGORIES));

    removeClaudiaoHooks(['ui']);

    const saved = readSettings();
    const commands = (saved.hooks?.PreToolUse ?? []).flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes('gsd-guard.js'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-security-reminder'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-migration-reminder'))).toBe(true);
    expect(commands.some((c) => c.includes('claudiao-ui-reminder'))).toBe(false);
  });

  it('removes everything when no filter is passed (existing behavior)', async () => {
    await installAll();
    const { removeClaudiaoHooks, listInstalledHooks } = await importHooks();

    const result = removeClaudiaoHooks();
    expect(result.removedCount).toBeGreaterThan(0);
    expect(listInstalledHooks()).toHaveLength(0);
  });

  it('returns zero when filter does not match any installed category', async () => {
    await installAll();
    const { removeClaudiaoHooks, listInstalledHooks } = await importHooks();

    // ensure all 4 categories are installed
    expect(listInstalledHooks()).toHaveLength(4);

    // remove only ui first
    removeClaudiaoHooks(['ui']);
    expect(listInstalledHooks()).toHaveLength(3);

    // second uninstall --only ui should find nothing to remove
    const result = removeClaudiaoHooks(['ui']);
    expect(result.removedCount).toBe(0);
    expect(listInstalledHooks()).toHaveLength(3);
  });
});
