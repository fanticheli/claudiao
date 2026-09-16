import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, CLAUDE_COMMANDS_DIR, getAgentsSource, getSkillsSource, getCommandsSource } from '../lib/paths.js';
import { createSymlink, ensureDir } from '../lib/symlinks.js';
import { disabledNames, enable, DisabledKind } from '../lib/disabled.js';
import { banner, success, warn, error, heading, info, dim, raw } from '../lib/format.js';

type ItemType = 'agent' | 'skill' | 'command';

const KIND: Record<ItemType, DisabledKind> = { agent: 'agents', skill: 'skills', command: 'commands' };

function locate(type: ItemType, name: string): { source: string; target: string } | null {
  if (type === 'agent') {
    const source = getAgentsSource();
    return source ? { source: join(source, `${name}.md`), target: join(CLAUDE_AGENTS_DIR, `${name}.md`) } : null;
  }
  if (type === 'command') {
    const source = getCommandsSource();
    return source ? { source: join(source, `${name}.md`), target: join(CLAUDE_COMMANDS_DIR, `${name}.md`) } : null;
  }
  const source = getSkillsSource();
  return source ? { source: join(source, name), target: join(CLAUDE_SKILLS_DIR, name) } : null;
}

export function enableItem(type: ItemType, name: string, options?: { dryRun?: boolean }): void {
  banner();
  heading(`Reativar ${type}: ${name}`);

  const paths = locate(type, name);
  if (!paths || !existsSync(paths.source)) {
    error(`${type} "${name}" nao existe nos templates.`);
    dim(`Rode \`claudiao list ${KIND[type]}\` pra ver os disponiveis.`);
    return;
  }

  const wasDisabled = enable(KIND[type], name);
  if (options?.dryRun) {
    info(`[dry-run] Reativaria ${name} e linkaria em ${paths.target}`);
    return;
  }

  if (!wasDisabled) warn(`${name} nao estava na lista de desativados.`);

  if (existsSync(paths.target)) {
    info(`${name} ja esta instalado.`);
  } else {
    ensureDir(type === 'skill' ? CLAUDE_SKILLS_DIR : type === 'agent' ? CLAUDE_AGENTS_DIR : CLAUDE_COMMANDS_DIR);
    createSymlink(paths.source, paths.target);
    success(`${name} reativado e linkado.`);
  }
  raw('');
}

export function listDisabled(): void {
  banner();
  heading('Desativados (nao recriados por update/init)');

  let total = 0;
  for (const kind of ['agents', 'skills', 'commands'] as DisabledKind[]) {
    const names = [...disabledNames(kind)];
    total += names.length;
    if (names.length === 0) continue;
    raw(`  ${chalk.bold(kind)}: ${names.join(', ')}`);
  }

  if (total === 0) info('Nada desativado.');
  raw('');
  dim('Desativar: `claudiao remove agent|skill|command <nome>`. Reativar: `claudiao enable agent|skill|command <nome>`.');
}
