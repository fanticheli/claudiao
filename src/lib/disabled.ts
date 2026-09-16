import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { CONFIG_FILE } from './paths.js';
import { debug } from './format.js';

export type DisabledKind = 'agents' | 'skills' | 'commands';

export interface ClaudiaoConfig {
  disabled?: Partial<Record<DisabledKind, string[]>>;
  [key: string]: unknown;
}

export function readConfig(): ClaudiaoConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ClaudiaoConfig) : {};
  } catch (err) {
    debug(`readConfig: ignored unreadable ${CONFIG_FILE} (${err instanceof Error ? err.message : String(err)})`);
    return {};
  }
}

export function writeConfig(config: ClaudiaoConfig): void {
  const temporary = `${CONFIG_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n');
  renameSync(temporary, CONFIG_FILE);
}

export function disabledNames(kind: DisabledKind): Set<string> {
  const list = readConfig().disabled?.[kind];
  return new Set(Array.isArray(list) ? list.filter((name) => typeof name === 'string') : []);
}

export function isDisabled(kind: DisabledKind, name: string): boolean {
  return disabledNames(kind).has(name);
}

export function disable(kind: DisabledKind, name: string): boolean {
  const config = readConfig();
  const current = new Set(config.disabled?.[kind] ?? []);
  if (current.has(name)) return false;
  current.add(name);
  config.disabled = { ...config.disabled, [kind]: [...current].sort() };
  writeConfig(config);
  return true;
}

export function enable(kind: DisabledKind, name: string): boolean {
  const config = readConfig();
  const current = new Set(config.disabled?.[kind] ?? []);
  if (!current.delete(name)) return false;
  config.disabled = { ...config.disabled, [kind]: [...current].sort() };
  writeConfig(config);
  return true;
}
