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
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-multi-event-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(CLAUDE_DIR_OVERRIDE, { recursive: true });
  mkdirSync(join(TEMPLATES_DIR, 'hooks', 'lib'), { recursive: true });
  writeFileSync(join(TEMPLATES_DIR, 'hooks', 'claudiao-review-gate.mjs'), '#!/usr/bin/env node\nprocess.exit(0)\n');
  writeFileSync(join(TEMPLATES_DIR, 'hooks', 'claudiao-credentials.mjs'), '#!/usr/bin/env node\nprocess.exit(0)\n');
  writeFileSync(join(TEMPLATES_DIR, 'hooks', 'claudiao-english-code.mjs'), '#!/usr/bin/env node\nprocess.exit(0)\n');
  writeFileSync(join(TEMPLATES_DIR, 'hooks', 'lib', 'portuguese.mjs'), 'export const words = [];\n');
});

afterEach(() => {
  if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  vi.resetModules();
});

async function withOverriddenClaudeDir() {
  const paths = await import('../paths.js');
  // @ts-expect-error test override
  paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;
  return importHooks();
}

describe('categories that handle more than one event', () => {
  it('registers the review gate on every event it declares, with a matcher only where it applies', async () => {
    const { HOOK_CATEGORIES, mergeHooksIntoSettings } = await withOverriddenClaudeDir();
    const gate = HOOK_CATEGORIES.find((c) => c.id === 'review-gate')!;

    const settings = mergeHooksIntoSettings([gate]);

    expect(settings.hooks?.PreToolUse?.[0].matcher).toBe(gate.matcher);
    for (const event of ['SubagentStop', 'UserPromptSubmit'] as const) {
      const entries = settings.hooks?.[event] ?? [];
      expect(entries).toHaveLength(1);
      expect(entries[0].matcher).toBeUndefined();
      expect(entries[0].hooks[0].command).toContain('claudiao-review-gate.mjs');
    }
  });

  it('is idempotent across events instead of duplicating entries', async () => {
    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings } = await withOverriddenClaudeDir();
    const credentials = HOOK_CATEGORIES.find((c) => c.id === 'credentials')!;

    writeSettings(mergeHooksIntoSettings([credentials]));
    const settings = mergeHooksIntoSettings([credentials]);

    const commands = Object.values(settings.hooks ?? {}).flatMap((list) =>
      (list ?? []).flatMap((matcher) => matcher.hooks.map((hook) => hook.command)),
    );
    expect(commands.filter((command) => command.includes('claudiao-credentials.mjs'))).toHaveLength(2);
  });

  it('uninstall removes the script from every event at once', async () => {
    const { HOOK_CATEGORIES, mergeHooksIntoSettings, writeSettings, removeClaudiaoHooks, listInstalledHooks } =
      await withOverriddenClaudeDir();
    const gate = HOOK_CATEGORIES.find((c) => c.id === 'review-gate')!;

    writeSettings(mergeHooksIntoSettings([gate]));
    expect(listInstalledHooks()).toHaveLength(3);

    const result = removeClaudiaoHooks(['review-gate']);
    expect(result.removedCount).toBe(3);
    expect(listInstalledHooks()).toHaveLength(0);
  });

  it('copies the files a hook imports next to the script', async () => {
    const { HOOK_CATEGORIES, copyHookScripts } = await withOverriddenClaudeDir();
    const englishCode = HOOK_CATEGORIES.find((c) => c.id === 'english-code')!;

    const copied = copyHookScripts([englishCode]);

    expect(existsSync(join(CLAUDE_DIR_OVERRIDE, 'hooks', 'lib', 'portuguese.mjs'))).toBe(true);
    expect(copied.some((path) => path.endsWith(join('lib', 'portuguese.mjs')))).toBe(true);
  });
});
