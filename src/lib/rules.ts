import { existsSync, readdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_DIR, getTemplatesPath } from './paths.js';
import { ensureDir } from './symlinks.js';

export const RULES_DIR = join(CLAUDE_DIR, 'rules');

export interface RuleStatus {
  name: string;
  source: string;
  destination: string;
  state: 'missing' | 'identical' | 'different';
}

export function rulesSource(): string {
  return join(getTemplatesPath(), 'rules');
}

export function availableRules(): RuleStatus[] {
  const source = rulesSource();
  if (!existsSync(source)) return [];
  return readdirSync(source)
    .filter((file) => file.endsWith('.md'))
    .map((name) => {
      const from = join(source, name);
      const to = join(RULES_DIR, name);
      if (!existsSync(to)) return { name, source: from, destination: to, state: 'missing' as const };
      const same = readFileSync(from, 'utf-8') === readFileSync(to, 'utf-8');
      return { name, source: from, destination: to, state: same ? ('identical' as const) : ('different' as const) };
    });
}

export function installRules(rules: RuleStatus[], force: boolean): RuleStatus[] {
  const installable = rules.filter((rule) => rule.state === 'missing' || force);
  if (installable.length === 0) return [];
  ensureDir(RULES_DIR);
  for (const rule of installable) copyFileSync(rule.source, rule.destination);
  return installable;
}
