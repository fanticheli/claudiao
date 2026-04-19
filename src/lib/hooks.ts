import { existsSync, readFileSync, rmSync, writeFileSync, chmodSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_DIR, getTemplatesPath } from './paths.js';
import { ensureDir } from './symlinks.js';

export const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');
export const HOOKS_DIR = join(CLAUDE_DIR, 'hooks');

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop';

export interface HookCategory {
  id: string;
  name: string;
  description: string;
  script: string;
  /**
   * Tool matcher for PreToolUse/PostToolUse events (e.g. 'Write|Edit').
   * `null` for events that don't use matchers (e.g. Stop).
   */
  matcher: string | null;
  event: HookEvent;
}

export interface ParsedOnlyFlag {
  ok: true;
  categories: HookCategory[];
}
export interface ParsedOnlyFlagError {
  ok: false;
  invalid: string[];
}

/**
 * Parses the `--only a,b,c` CSV flag into a list of HookCategory objects.
 * Trims, lowercases and de-dupes; unknown ids land in `invalid` so the
 * caller can abort with a clear message. Shared by install and uninstall
 * so the two stay in sync.
 */
export function parseOnlyFlag(raw: string): ParsedOnlyFlag | ParsedOnlyFlagError {
  const requested = Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    ),
  );
  const categories: HookCategory[] = [];
  const invalid: string[] = [];
  for (const id of requested) {
    const cat = HOOK_CATEGORIES.find((c) => c.id === id);
    if (cat) categories.push(cat);
    else invalid.push(id);
  }
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, categories };
}

export const HOOK_CATEGORIES: HookCategory[] = [
  {
    id: 'security',
    name: 'Security reminder',
    description: 'Lembra /security-checklist ao editar endpoints, routes, auth',
    script: 'claudiao-security-reminder.mjs',
    matcher: 'Write|Edit',
    event: 'PreToolUse',
  },
  {
    id: 'ui',
    name: 'UI review reminder',
    description: 'Lembra /ui-review-checklist ao editar componentes de UI',
    script: 'claudiao-ui-reminder.mjs',
    matcher: 'Write|Edit',
    event: 'PreToolUse',
  },
  {
    id: 'migration',
    name: 'Migration reminder',
    description: 'Lembra patterns zero-downtime ao criar ou editar migrations SQL',
    script: 'claudiao-migration-reminder.mjs',
    matcher: 'Write|Edit',
    event: 'PreToolUse',
  },
  {
    id: 'commit',
    name: 'Conventional commit reminder',
    description: 'Valida formato conventional commits ao rodar git commit',
    script: 'claudiao-commit-reminder.mjs',
    matcher: 'Bash',
    event: 'PreToolUse',
  },
  {
    id: 'pr',
    name: 'PR reminder',
    description: 'Lembra /pr-template e /security-checklist ao finalizar sessão com edits',
    script: 'claudiao-pr-reminder.mjs',
    matcher: null,
    event: 'Stop',
  },
];

const LEGACY_SCRIPT_EXT = '.sh';

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
  hooks?: Partial<Record<'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'Stop', HookMatcher[]>>;
  [key: string]: unknown;
}

export function isClaudiaoHook(command: string): boolean {
  return command.includes('claudiao-') && (command.endsWith('.mjs') || command.endsWith(LEGACY_SCRIPT_EXT));
}

/**
 * Maps a (possibly legacy .sh) script name back to its HookCategory, so
 * install/uninstall can migrate entries from earlier versions. Returns
 * null if the script is not one of the known categories.
 */
export function findCategoryByScript(scriptPath: string): HookCategory | null {
  return (
    HOOK_CATEGORIES.find((c) => {
      const base = c.script.replace(/\.mjs$/, '');
      return (
        scriptPath.endsWith(c.script) ||
        scriptPath.endsWith(`${base}.sh`)
      );
    }) ?? null
  );
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
 * Copies hook scripts from templates/ to ~/.claude/hooks/ and makes them
 * executable. Removes legacy .sh variants for the same category so users
 * upgrading from pre-1.2 don't keep stale shell scripts lying around.
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

    const legacyDest = dest.replace(/\.mjs$/, LEGACY_SCRIPT_EXT);
    if (legacyDest !== dest && existsSync(legacyDest)) {
      rmSync(legacyDest);
    }
  }
  return copied;
}

/**
 * Merges claudiao hook entries into existing settings.json. Safe to run
 * multiple times — dedupes by command path and migrates any legacy .sh
 * entries written by pre-1.2 versions of claudiao.
 */
export function mergeHooksIntoSettings(categories: HookCategory[]): SettingsJson {
  const settings = readSettings();
  settings.hooks = settings.hooks ?? {};

  const categoryScripts = new Set(
    categories.flatMap((c) => [c.script, c.script.replace(/\.mjs$/, '.sh')]),
  );

  // Clean claudiao entries for the target categories once per event.
  // Previously this was done inside the per-category loop, which meant
  // iteration N+1 would filter out the entries iteration N had just
  // written — losing every category except the last.
  const eventsTouched = new Set(categories.map((c) => c.event));
  for (const event of eventsTouched) {
    const list = (settings.hooks[event] ?? []) as HookMatcher[];
    const cleaned: HookMatcher[] = [];
    for (const matcher of list) {
      const kept = matcher.hooks.filter((h) => {
        if (h.type !== 'command') return true;
        if (!isClaudiaoHook(h.command)) return true;
        return !categoryScripts.has(h.command.split('/').pop() ?? '');
      });
      if (kept.length > 0) cleaned.push({ ...matcher, hooks: kept });
    }
    settings.hooks[event] = cleaned;
  }

  for (const cat of categories) {
    const command = join(HOOKS_DIR, cat.script);
    const list = (settings.hooks[cat.event] ?? []) as HookMatcher[];

    // For matcher-less events (e.g. Stop), group under entries without a
    // `matcher` key. For matcher-aware events, group by matcher string.
    const existing = list.find((m) =>
      cat.matcher === null ? m.matcher === undefined : m.matcher === cat.matcher,
    );
    if (existing) {
      existing.hooks.push({ type: 'command', command, timeout: 5 });
    } else {
      const entry: HookMatcher = { hooks: [{ type: 'command', command, timeout: 5 }] };
      if (cat.matcher !== null) entry.matcher = cat.matcher;
      list.push(entry);
    }

    settings.hooks[cat.event] = list;
  }

  return settings;
}

/**
 * Fixes up claudiao hook entries whose `matcher` drifted from the
 * current HOOK_CATEGORIES definition. Only touches entries that
 * `isClaudiaoHook` recognizes — user/other-plugin hooks with the same
 * matcher string are never moved. Used on `hooks install` to heal
 * installs from earlier claudiao versions (e.g. 1.2.0 shipped the
 * migration hook with matcher 'Write' instead of 'Write|Edit').
 *
 * Returns the number of claudiao hook entries whose matcher was
 * rewritten to the current canonical value.
 */
export function migrateClaudiaoHookMatchers(): number {
  const settings = readSettings();
  if (!settings.hooks) return 0;

  let migrated = 0;

  for (const event of Object.keys(settings.hooks) as Array<keyof NonNullable<SettingsJson['hooks']>>) {
    const list = settings.hooks[event];
    if (!list) continue;

    // Collect claudiao entries that are in the wrong matcher bucket.
    type Move = { command: string; entry: HookEntry; target: HookCategory };
    const moves: Move[] = [];

    for (const matcher of list) {
      for (const h of matcher.hooks) {
        if (h.type !== 'command' || !isClaudiaoHook(h.command)) continue;
        const cat = findCategoryByScript(h.command);
        if (!cat) continue;
        if (cat.event !== event) continue;
        const currentMatcher = matcher.matcher ?? null;
        if (currentMatcher !== cat.matcher) {
          moves.push({ command: h.command, entry: h, target: cat });
        }
      }
    }

    if (moves.length === 0) continue;

    // Drop the stale entries from their current matchers.
    const moveCommands = new Set(moves.map((m) => m.command));
    const filtered: HookMatcher[] = [];
    for (const matcher of list) {
      const kept = matcher.hooks.filter((h) => {
        if (h.type !== 'command') return true;
        return !moveCommands.has(h.command);
      });
      if (kept.length > 0) filtered.push({ ...matcher, hooks: kept });
    }

    // Re-insert under the canonical matcher.
    for (const move of moves) {
      const existing = filtered.find((m) =>
        move.target.matcher === null ? m.matcher === undefined : m.matcher === move.target.matcher,
      );
      if (existing) {
        existing.hooks.push(move.entry);
      } else {
        const entry: HookMatcher = { hooks: [move.entry] };
        if (move.target.matcher !== null) entry.matcher = move.target.matcher;
        filtered.push(entry);
      }
      migrated++;
    }

    if (filtered.length > 0) {
      settings.hooks[event] = filtered;
    } else {
      delete settings.hooks[event];
    }
  }

  if (migrated > 0) {
    if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
    writeSettings(settings);
  }

  return migrated;
}

/**
 * Removes claudiao-managed hooks from settings.json, preserving other
 * hooks. If `onlyCategories` is provided, removes only those category
 * ids; otherwise removes every claudiao hook.
 */
export function removeClaudiaoHooks(
  onlyCategories?: string[],
): { removedCount: number; categoriesRemoved: string[] } {
  const settings = readSettings();
  if (!settings.hooks) return { removedCount: 0, categoriesRemoved: [] };

  const filterSet = onlyCategories && onlyCategories.length > 0 ? new Set(onlyCategories) : null;

  let removedCount = 0;
  const categoriesRemoved = new Set<string>();

  for (const event of Object.keys(settings.hooks) as Array<keyof NonNullable<SettingsJson['hooks']>>) {
    const list = settings.hooks[event];
    if (!list) continue;

    const filtered: HookMatcher[] = [];

    for (const m of list) {
      const kept = m.hooks.filter((h) => {
        if (h.type !== 'command' || !isClaudiaoHook(h.command)) return true;
        const cat = findCategoryByScript(h.command);
        if (filterSet && (!cat || !filterSet.has(cat.id))) return true;
        removedCount++;
        if (cat) categoriesRemoved.add(cat.id);
        return false;
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
          const cat = findCategoryByScript(h.command);
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
