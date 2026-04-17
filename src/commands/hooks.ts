import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  HOOK_CATEGORIES,
  HookCategory,
  copyHookScripts,
  mergeHooksIntoSettings,
  writeSettings,
  removeClaudiaoHooks,
  listInstalledHooks,
  SETTINGS_FILE,
} from '../lib/hooks.js';
import { banner, success, warn, error, info, heading, dim, separator } from '../lib/format.js';

export async function installHooks(options?: { only?: string; dryRun?: boolean }): Promise<void> {
  banner();
  heading('Instalando hooks do claudiao');

  const dryRun = options?.dryRun ?? false;
  if (dryRun) {
    info('[dry-run] Nenhuma alteração será feita');
    console.log('');
  }

  // Resolve categorias a instalar
  let selected: HookCategory[];
  if (options?.only) {
    const requested = options.only.split(',').map((s) => s.trim().toLowerCase());
    const found: HookCategory[] = [];
    const missing: string[] = [];
    for (const id of requested) {
      const cat = HOOK_CATEGORIES.find((c) => c.id === id);
      if (cat) found.push(cat);
      else missing.push(id);
    }
    if (missing.length > 0) {
      error(`Categorias desconhecidas: ${missing.join(', ')}`);
      dim(`Disponíveis: ${HOOK_CATEGORIES.map((c) => c.id).join(', ')}`);
      process.exit(1);
    }
    selected = found;
  } else {
    // Interactive: multi-select
    console.log(chalk.dim('  Hooks lembram de invocar skills em momentos críticos.'));
    console.log(chalk.dim('  São lembretes não-bloqueantes injetados no contexto do Claude.'));
    console.log('');

    const { picked } = await inquirer.prompt<{ picked: string[] }>([
      {
        type: 'checkbox',
        name: 'picked',
        message: 'Selecione hooks pra instalar (espaço pra marcar, enter pra confirmar):',
        choices: HOOK_CATEGORIES.map((c) => ({
          name: `${chalk.bold(c.name)} ${chalk.dim('— ' + c.description)}`,
          value: c.id,
          checked: true,
        })),
      },
    ]);

    if (picked.length === 0) {
      warn('Nenhum hook selecionado. Abortando.');
      return;
    }

    selected = HOOK_CATEGORIES.filter((c) => picked.includes(c.id));
  }

  // Mostra o que vai ser feito
  console.log('');
  for (const cat of selected) {
    info(`${chalk.bold(cat.name)} — ${chalk.dim(cat.description)}`);
  }
  console.log('');

  if (dryRun) {
    info(`[dry-run] Copiaria ${selected.length} script(s) pra ~/.claude/hooks/`);
    info(`[dry-run] Faria merge em ${SETTINGS_FILE}`);
    return;
  }

  // Copy scripts
  const copied = copyHookScripts(selected);
  success(`${copied.length} script(s) copiado(s) pra ~/.claude/hooks/`);

  // Merge into settings.json
  const settings = mergeHooksIntoSettings(selected);
  writeSettings(settings);
  success(`Hooks registrados em ${SETTINGS_FILE}`);

  separator();
  console.log(chalk.green.bold('  Hooks do claudiao ativos.'));
  separator();

  console.log(chalk.bold('  Próximos passos:'));
  console.log(`  ${chalk.cyan('1.')} Abra uma nova sessão do Claude Code (os hooks carregam no SessionStart)`);
  console.log(`  ${chalk.cyan('2.')} Edite um endpoint/componente/migration — o lembrete aparece automaticamente`);
  console.log(`  ${chalk.cyan('3.')} Rode ${chalk.yellow('claudiao hooks list')} pra ver o que está ativo`);
  console.log(`  ${chalk.cyan('4.')} Rode ${chalk.yellow('claudiao hooks uninstall')} pra remover`);
  console.log('');
}

export async function uninstallHooks(options?: { yes?: boolean }): Promise<void> {
  banner();
  heading('Removendo hooks do claudiao');

  const installed = listInstalledHooks();
  if (installed.length === 0) {
    info('Nenhum hook do claudiao instalado. Nada a remover.');
    return;
  }

  console.log(chalk.dim(`  ${installed.length} hook(s) do claudiao encontrado(s):`));
  for (const h of installed) {
    console.log(`    - ${h.event} / matcher=${chalk.dim(h.matcher)} / categoria=${chalk.yellow(h.category ?? '?')}`);
  }
  console.log('');

  if (!options?.yes) {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Remover todos os hooks do claudiao? (scripts em ~/.claude/hooks/ não são apagados)',
        default: false,
      },
    ]);
    if (!confirm) {
      warn('Cancelado.');
      return;
    }
  }

  const { removedCount, categoriesRemoved } = removeClaudiaoHooks();

  if (removedCount === 0) {
    info('Nada foi removido.');
    return;
  }

  success(`${removedCount} hook(s) removido(s) de settings.json`);
  if (categoriesRemoved.length > 0) {
    dim(`Categorias: ${categoriesRemoved.join(', ')}`);
  }
  dim('Os scripts em ~/.claude/hooks/ foram mantidos (remova manualmente se quiser).');
  console.log('');
}

export function listHooks(): void {
  banner();
  heading('Hooks do claudiao instalados');

  const installed = listInstalledHooks();

  if (installed.length === 0) {
    info('Nenhum hook do claudiao instalado.');
    console.log('');
    dim(`Instale com: ${chalk.yellow('claudiao hooks install')}`);
    console.log('');
    console.log(chalk.bold('  Categorias disponíveis:'));
    for (const cat of HOOK_CATEGORIES) {
      console.log(`    ${chalk.yellow(cat.id.padEnd(12))}${chalk.dim(cat.description)}`);
    }
    console.log('');
    return;
  }

  for (const h of installed) {
    const cat = HOOK_CATEGORIES.find((c) => c.id === h.category);
    const name = cat?.name ?? 'desconhecido';
    console.log(`  ${chalk.green('●')} ${chalk.bold(name)} ${chalk.dim('[' + h.category + ']')}`);
    dim(`event=${h.event}  matcher=${h.matcher}`);
    dim(`script=${h.command}`);
    console.log('');
  }

  console.log(chalk.bold('  Categorias não instaladas:'));
  const installedIds = new Set(installed.map((h) => h.category));
  const available = HOOK_CATEGORIES.filter((c) => !installedIds.has(c.id));
  if (available.length === 0) {
    dim('(todas instaladas)');
  } else {
    for (const cat of available) {
      console.log(`    ${chalk.dim('○')} ${chalk.yellow(cat.id.padEnd(12))}${chalk.dim(cat.description)}`);
    }
  }
  console.log('');
}
