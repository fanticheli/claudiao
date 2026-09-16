import chalk from 'chalk';
import { availableRules, installRules, RULES_DIR } from '../lib/rules.js';
import { banner, success, warn, info, heading, dim, raw } from '../lib/format.js';

export function installRulesCommand(options?: { force?: boolean; dryRun?: boolean }): void {
  banner();
  heading('Instalando regras globais em ~/.claude/rules');

  const rules = availableRules();
  if (rules.length === 0) {
    warn('Nenhuma regra encontrada em templates/rules.');
    return;
  }

  const pending = rules.filter((rule) => rule.state === 'missing' || (options?.force && rule.state === 'different'));
  if (options?.dryRun) {
    for (const rule of pending) info(`[dry-run] ${rule.name} seria escrito em ${rule.destination}`);
    if (pending.length === 0) info('[dry-run] Nada a fazer');
    return;
  }

  const installed = installRules(rules, options?.force ?? false);
  for (const rule of installed) success(`${rule.name} instalada`);

  const skipped = rules.filter((rule) => rule.state === 'different' && !options?.force);
  for (const rule of skipped) {
    warn(`${rule.name} já existe e está diferente; mantida. Use --force para sobrescrever.`);
  }

  if (installed.length === 0 && skipped.length === 0) info('Tudo já estava atualizado.');
  raw('');
  dim(`As regras são carregadas pelo Claude Code em toda sessão a partir de ${RULES_DIR}`);
}

export function listRulesCommand(): void {
  banner();
  heading('Regras globais');
  const rules = availableRules();
  if (rules.length === 0) {
    warn('Nenhuma regra encontrada em templates/rules.');
    return;
  }
  const label = { missing: chalk.red('não instalada'), identical: chalk.green('instalada'), different: chalk.yellow('modificada localmente') };
  for (const rule of rules) {
    raw(`  ${chalk.bold(rule.name)} ${label[rule.state]}`);
    dim(rule.destination);
  }
  raw('');
}
