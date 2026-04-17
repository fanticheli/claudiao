import { existsSync, readFileSync, writeFileSync, chmodSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_DIR, getTemplatesPath } from './paths.js';
import { ensureDir } from './symlinks.js';

export const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');
export const HOOKS_DIR = join(CLAUDE_DIR, 'hooks');

export interface HookCategory {
  id: string;
  name: string;
  description: string;
  script: string;
  matcher: string;
  event: 'PreToolUse' | 'PostToolUse';
}

export const HOOK_CATEGORIES: HookCategory[] = [
  {
    id: 'security',
    name: 'Security reminder',
    description: 'Lembra /security-checklist ao editar endpoints, routes, auth',
    script: 'claudiao-security-reminder.sh',
    matcher: 'Write|Edit',
    event: 'PreToolUse',
  },
  {
    id: 'ui',
    name: 'UI review reminder',
    description: 'Lembra /ui-review-checklist ao editar componentes de UI',
    script: 'claudiao-ui-reminder.sh',
    matcher: 'Write|Edit',
    event: 'PreToolUse',
  },
  {
    id: 'migration',
    name: 'Migration reminder',
    description: 'Lembra patterns zero-downtime ao criar migrations SQL',
    script: 'claudiao-migration-reminder.sh',
    matcher: 'Write',
    event: 'PreToolUse',
  },
  {
    id: 'commit',
    name: 'Conventional commit reminder',
    description: 'Valida formato conventional commits ao rodar git commit',
    script: 'claudiao-commit-reminder.sh',
    matcher: 'Bash',
    event: 'PreToolUse',
  },
];

interface HookEntry {
  type: 'command';
  command: string;
  timeout?: number;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface SettingsJson {
  hooks?: Partial<Record<'PreToolUse' | 'PostToolUse' | 'SessionStart', HookMatcher[]>>;
  [key: string]: unknown;
}

export function isClaudiaoHook(command: string): boolean {
  return command.includes('claudiao-') && command.endsWith('.sh');
}

export function readSettings(): SettingsJson {
  if (!existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) as SettingsJson;
  } catch {
    return {};
  }
}

export function writeSettings(settings: SettingsJson): void {
  ensureDir(CLAUDE_DIR);
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Copies hook scripts from templates/ to ~/.claude/hooks/ and makes them executable.
 */
export function copyHookScripts(categories: HookCategory[]): string[] {
  ensureDir(HOOKS_DIR);
  const copied: string[] = [];
  const source = join(getTemplatesPath(), 'hooks');

  for (const cat of categories) {
    const src = join(source, cat.script);
    const dest = join(HOOKS_DIR, cat.script);
    if (!existsSync(src)) continue;
    copyFileSync(src, dest);
    chmodSync(dest, 0o755);
    copied.push(dest);
  }
  return copied;
}

/**
 * Merges claudiao hook entries into existing settings.json. Safe to run
 * multiple times — dedupes by command path.
 */
export function mergeHooksIntoSettings(categories: HookCategory[]): SettingsJson {
  const settings = readSettings();
  settings.hooks = settings.hooks ?? {};

  for (const cat of categories) {
    const command = join(HOOKS_DIR, cat.script);
    const entry: HookMatcher = {
      matcher: cat.matcher,
      hooks: [{ type: 'command', command, timeout: 5 }],
    };

    const list = (settings.hooks[cat.event] ?? []) as HookMatcher[];

    // Se já existe um matcher deste mesmo tipo, merge os hooks
    // Senão, adiciona nova entrada
    const existing = list.find((m) => m.matcher === cat.matcher);
    if (existing) {
      const alreadyHasClaudiao = existing.hooks.some(
        (h) => h.type === 'command' && h.command === command,
      );
      if (!alreadyHasClaudiao) {
        existing.hooks.push({ type: 'command', command, timeout: 5 });
      }
    } else {
      list.push(entry);
    }

    settings.hooks[cat.event] = list;
  }

  return settings;
}

/**
 * Removes all claudiao-managed hooks from settings.json. Preserves other hooks.
 */
export function removeClaudiaoHooks(): { removedCount: number; categoriesRemoved: string[] } {
  const settings = readSettings();
  if (!settings.hooks) return { removedCount: 0, categoriesRemoved: [] };

  let removedCount = 0;
  const categoriesRemoved = new Set<string>();

  for (const event of Object.keys(settings.hooks) as Array<keyof NonNullable<SettingsJson['hooks']>>) {
    const list = settings.hooks[event];
    if (!list) continue;

    const filtered: HookMatcher[] = [];

    for (const m of list) {
      const kept = m.hooks.filter((h) => {
        if (h.type === 'command' && isClaudiaoHook(h.command)) {
          removedCount++;
          // Infer category from script name
          const cat = HOOK_CATEGORIES.find((c) => h.command.endsWith(c.script));
          if (cat) categoriesRemoved.add(cat.id);
          return false;
        }
        return true;
      });

      if (kept.length > 0) {
        filtered.push({ ...m, hooks: kept });
      }
    }

    if (filtered.length > 0) {
      settings.hooks[event] = filtered;
    } else {
      delete settings.hooks[event];
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(settings);
  return { removedCount, categoriesRemoved: Array.from(categoriesRemoved) };
}

/**
 * Lists all claudiao-managed hooks currently active in settings.json.
 */
export function listInstalledHooks(): Array<{ event: string; matcher: string; category: string | null; command: string }> {
  const settings = readSettings();
  if (!settings.hooks) return [];

  const result: Array<{ event: string; matcher: string; category: string | null; command: string }> = [];

  for (const [event, list] of Object.entries(settings.hooks)) {
    if (!list) continue;
    for (const m of list) {
      for (const h of m.hooks) {
        if (h.type === 'command' && isClaudiaoHook(h.command)) {
          const cat = HOOK_CATEGORIES.find((c) => h.command.endsWith(c.script));
          result.push({
            event,
            matcher: m.matcher ?? '',
            category: cat?.id ?? null,
            command: h.command,
          });
        }
      }
    }
  }

  return result;
}
