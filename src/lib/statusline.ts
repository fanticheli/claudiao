import { existsSync, copyFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_DIR, getTemplatesPath } from './paths.js';
import { ensureDir } from './symlinks.js';
import { readSettings, writeSettings, SETTINGS_FILE } from './hooks.js';

export { SETTINGS_FILE };

export const STATUSLINE_DIR = join(CLAUDE_DIR, 'statusline');
export const STATUSLINE_SCRIPT = 'context-bar.mjs';
export const STATUSLINE_DEST = join(STATUSLINE_DIR, STATUSLINE_SCRIPT);

export interface StatusLineConfig {
  type: 'command';
  command: string;
  padding?: number;
}

interface SettingsWithStatusLine {
  statusLine?: StatusLineConfig | undefined;
  [key: string]: unknown;
}

export function isClaudiaoStatusline(command: string | undefined): boolean {
  if (!command) return false;
  return command.includes('statusline/') && command.endsWith(STATUSLINE_SCRIPT);
}

export function getInstalledStatusline(): StatusLineConfig | null {
  const settings = readSettings() as SettingsWithStatusLine;
  return settings.statusLine ?? null;
}

export function copyStatuslineScript(): string {
  ensureDir(STATUSLINE_DIR);
  const src = join(getTemplatesPath(), 'statusline', STATUSLINE_SCRIPT);
  if (!existsSync(src)) {
    throw new Error(`Template da statusline não encontrado em ${src}`);
  }
  copyFileSync(src, STATUSLINE_DEST);
  chmodSync(STATUSLINE_DEST, 0o755);
  return STATUSLINE_DEST;
}

export function buildStatuslineEntry(): StatusLineConfig {
  return {
    type: 'command',
    command: `node ${STATUSLINE_DEST}`,
  };
}

export function writeStatuslineIntoSettings(entry: StatusLineConfig): void {
  const settings = readSettings() as SettingsWithStatusLine;
  settings.statusLine = entry;
  writeSettings(settings);
}

/**
 * Removes the statusLine entry only if it points to a claudiao-managed
 * script. Foreign (user or other-plugin) statusLine configs are left
 * untouched, consistent with how `hooks uninstall` preserves non-claudiao
 * entries.
 */
export function removeStatuslineFromSettings(): { removed: boolean; reason: string | null } {
  const settings = readSettings() as SettingsWithStatusLine;
  const current = settings.statusLine;
  if (!current) {
    return { removed: false, reason: 'nenhuma statusLine configurada' };
  }
  if (!isClaudiaoStatusline(current.command)) {
    return { removed: false, reason: 'statusLine atual não foi instalada pelo claudiao' };
  }
  delete settings.statusLine;
  writeSettings(settings);
  return { removed: true, reason: null };
}
