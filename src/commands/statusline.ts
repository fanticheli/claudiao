import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  STATUSLINE_DEST,
  STATUSLINE_SCRIPT,
  isClaudiaoStatusline,
  getInstalledStatusline,
  copyStatuslineScript,
  buildStatuslineEntry,
  writeStatuslineIntoSettings,
  removeStatuslineFromSettings,
  SETTINGS_FILE,
} from '../lib/statusline.js';
import { banner, success, warn, error, info, heading, dim, separator, raw } from '../lib/format.js';

export async function installStatusline(options?: { force?: boolean; dryRun?: boolean }): Promise<void> {
  banner();
  heading('Instalando statusline do claudiao');

  const dryRun = options?.dryRun ?? false;
  const force = options?.force ?? false;

  if (dryRun) {
    info('[dry-run] Nenhuma alteração será feita');
    raw('');
  }

  const current = getInstalledStatusline();

  if (current && !isClaudiaoStatusline(current.command) && !force) {
    warn('Já existe uma statusLine configurada em settings.json que não foi instalada pelo claudiao.');
    dim(`Atual: ${current.command}`);
    raw('');
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Substituir pela statusline do claudiao? (a atual será perdida)',
        default: false,
      },
    ]);
    if (!confirm) {
      warn('Cancelado. Use --force pra pular essa pergunta.');
      return;
    }
  }

  raw(chalk.dim('  context-bar: mostra dir, branch, modelo, % de contexto usado e custo da sessão.'));
  raw(chalk.dim('  Cores: verde <60%, amarelo 60-85%, vermelho >85%.'));
  raw('');

  if (dryRun) {
    info(`[dry-run] Copiaria template pra ${STATUSLINE_DEST}`);
    info(`[dry-run] Registraria statusLine em ${SETTINGS_FILE}`);
    return;
  }

  const dest = copyStatuslineScript();
  success(`Script copiado pra ${dest}`);

  const entry = buildStatuslineEntry();
  writeStatuslineIntoSettings(entry);
  success(`statusLine registrada em ${SETTINGS_FILE}`);

  separator();
  raw(chalk.green.bold('  Statusline do claudiao ativa.'));
  separator();

  raw(chalk.bold('  Próximos passos:'));
  raw(`  ${chalk.cyan('1.')} Abra uma nova sessão do Claude Code`);
  raw(`  ${chalk.cyan('2.')} A barra aparece no rodapé com o uso de contexto em tempo real`);
  raw(`  ${chalk.cyan('3.')} Rode ${chalk.yellow('claudiao statusline list')} pra ver o status`);
  raw(`  ${chalk.cyan('4.')} Rode ${chalk.yellow('claudiao statusline uninstall')} pra remover`);
  raw('');
}

export async function uninstallStatusline(options?: { yes?: boolean }): Promise<void> {
  banner();
  heading('Removendo statusline do claudiao');

  const current = getInstalledStatusline();
  if (!current) {
    info('Nenhuma statusLine configurada. Nada a remover.');
    return;
  }
  if (!isClaudiaoStatusline(current.command)) {
    warn('A statusLine atual não foi instalada pelo claudiao — não será tocada.');
    dim(`Atual: ${current.command}`);
    return;
  }

  if (!options?.yes) {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Remover statusLine do claudiao de ${SETTINGS_FILE}? (o script em ~/.claude/statusline/ não é apagado)`,
        default: false,
      },
    ]);
    if (!confirm) {
      warn('Cancelado.');
      return;
    }
  }

  const { removed, reason } = removeStatuslineFromSettings();
  if (!removed) {
    error(`Não foi removida: ${reason ?? 'motivo desconhecido'}`);
    return;
  }

  success('statusLine removida de settings.json');
  dim(`Script em ${STATUSLINE_DEST} foi mantido (remova manualmente se quiser).`);
  raw('');
}

export function listStatusline(): void {
  banner();
  heading('Statusline do claudiao');

  const current = getInstalledStatusline();
  if (!current) {
    info('Nenhuma statusLine configurada.');
    raw('');
    dim(`Instale com: ${chalk.yellow('claudiao statusline install')}`);
    raw('');
    return;
  }

  const managed = isClaudiaoStatusline(current.command);
  const label = managed ? chalk.green('gerenciada pelo claudiao') : chalk.yellow('não gerenciada pelo claudiao');
  raw(`  ${chalk.bold('statusLine')} ${chalk.dim('—')} ${label}`);
  dim(`type=${current.type}`);
  dim(`command=${current.command}`);
  raw('');

  if (managed) {
    raw(chalk.dim('  Script bundled:'));
    dim(`  ~/.claude/statusline/${STATUSLINE_SCRIPT}`);
    raw('');
  } else {
    raw(chalk.dim('  Pra substituir pela do claudiao, use:'));
    dim(`  claudiao statusline install --force`);
    raw('');
  }
}
