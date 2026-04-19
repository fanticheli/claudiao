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
  migrateClaudiaoHookMatchers,
  parseOnlyFlag,
  SETTINGS_FILE,
} from '../lib/hooks.js';
import { banner, success, warn, error, info, heading, dim, separator, raw } from '../lib/format.js';

export async function installHooks(options?: { only?: string; dryRun?: boolean }): Promise<void> {
  banner();
  heading('Instalando hooks do claudiao');

  const dryRun = options?.dryRun ?? false;
  if (dryRun) {
    info('[dry-run] Nenhuma alteração será feita');
    raw('');
  }

  // Silently heal hooks installed by older claudiao versions whose
  // matcher drifted (e.g. migration shipped as 'Write' in 1.2.0 and is
  // 'Write|Edit' from 1.2.1 on).
  if (!dryRun) {
    const migrated = migrateClaudiaoHookMatchers();
    if (migrated > 0) {
      dim(`Migrados ${migrated} hook(s) com matchers desatualizados de versões anteriores.`);
    }
  }

  // Resolve categorias a instalar
  let selected: HookCategory[];
  if (options?.only) {
    const parsed = parseOnlyFlag(options.only);
    if (!parsed.ok) {
      error(`Categorias desconhecidas: ${parsed.invalid.join(', ')}`);
      dim(`Disponíveis: ${HOOK_CATEGORIES.map((c) => c.id).join(', ')}`);
      process.exit(1);
    }
    if (parsed.categories.length === 0) {
      error('Nenhuma categoria informada em --only.');
      process.exit(1);
    }
    selected = parsed.categories;
  } else {
    // Interactive: multi-select
    raw(chalk.dim('  Hooks lembram de invocar skills em momentos críticos.'));
    raw(chalk.dim('  São lembretes não-bloqueantes injetados no contexto do Claude.'));
    raw('');

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
  raw('');
  for (const cat of selected) {
    info(`${chalk.bold(cat.name)} — ${chalk.dim(cat.description)}`);
  }
  raw('');

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
  raw(chalk.green.bold('  Hooks do claudiao ativos.'));
  separator();

  raw(chalk.bold('  Próximos passos:'));
  raw(`  ${chalk.cyan('1.')} Abra uma nova sessão do Claude Code (os hooks carregam no SessionStart)`);
  raw(`  ${chalk.cyan('2.')} Edite um endpoint/componente/migration — o lembrete aparece automaticamente`);
  raw(`  ${chalk.cyan('3.')} Rode ${chalk.yellow('claudiao hooks list')} pra ver o que está ativo`);
  raw(`  ${chalk.cyan('4.')} Rode ${chalk.yellow('claudiao hooks uninstall')} pra remover`);
  raw('');
}

export async function uninstallHooks(options?: { yes?: boolean; only?: string }): Promise<void> {
  banner();
  heading('Removendo hooks do claudiao');

  let filterIds: string[] | undefined;
  if (options?.only) {
    const parsed = parseOnlyFlag(options.only);
    if (!parsed.ok) {
      error(`Categorias desconhecidas: ${parsed.invalid.join(', ')}`);
      dim(`Disponíveis: ${HOOK_CATEGORIES.map((c) => c.id).join(', ')}`);
      process.exit(1);
    }
    if (parsed.categories.length === 0) {
      error('Nenhuma categoria informada em --only.');
      process.exit(1);
    }
    filterIds = parsed.categories.map((c) => c.id);
  }

  const installed = listInstalledHooks();
  if (installed.length === 0) {
    info('Nenhum hook do claudiao instalado. Nada a remover.');
    return;
  }

  const targeted = filterIds
    ? installed.filter((h) => h.category !== null && filterIds!.includes(h.category))
    : installed;

  if (targeted.length === 0) {
    info('Nenhum hook correspondente a --only instalado. Nada a remover.');
    return;
  }

  raw(chalk.dim(`  ${targeted.length} hook(s) do claudiao a remover:`));
  for (const h of targeted) {
    const matcherLabel = h.matcher.length > 0 ? h.matcher : '(none)';
    raw(`    - ${h.event} / matcher=${chalk.dim(matcherLabel)} / categoria=${chalk.yellow(h.category ?? '?')}`);
  }
  raw('');

  if (!options?.yes) {
    const message = filterIds
      ? `Remover hooks das categorias [${filterIds.join(', ')}]? (scripts em ~/.claude/hooks/ não são apagados)`
      : 'Remover todos os hooks do claudiao? (scripts em ~/.claude/hooks/ não são apagados)';
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message,
        default: false,
      },
    ]);
    if (!confirm) {
      warn('Cancelado.');
      return;
    }
  }

  const { removedCount, categoriesRemoved } = removeClaudiaoHooks(filterIds);

  if (removedCount === 0) {
    info('Nada foi removido.');
    return;
  }

  success(`${removedCount} hook(s) removido(s) de settings.json`);
  if (categoriesRemoved.length > 0) {
    dim(`Categorias: ${categoriesRemoved.join(', ')}`);
  }
  dim('Os scripts em ~/.claude/hooks/ foram mantidos (remova manualmente se quiser).');
  raw('');
}

export function listHooks(): void {
  banner();
  heading('Hooks do claudiao instalados');

  const installed = listInstalledHooks();

  if (installed.length === 0) {
    info('Nenhum hook do claudiao instalado.');
    raw('');
    dim(`Instale com: ${chalk.yellow('claudiao hooks install')}`);
    raw('');
    raw(chalk.bold('  Categorias disponíveis:'));
    for (const cat of HOOK_CATEGORIES) {
      raw(`    ${chalk.yellow(cat.id.padEnd(12))}${chalk.dim(cat.description)}`);
    }
    raw('');
    return;
  }

  for (const h of installed) {
    const cat = HOOK_CATEGORIES.find((c) => c.id === h.category);
    const name = cat?.name ?? 'desconhecido';
    const matcherLabel = h.matcher.length > 0 ? h.matcher : '(none)';
    raw(`  ${chalk.green('●')} ${chalk.bold(name)} ${chalk.dim('[' + h.category + ']')}`);
    dim(`event=${h.event}  matcher=${matcherLabel}`);
    dim(`script=${h.command}`);
    raw('');
  }

  raw(chalk.bold('  Categorias não instaladas:'));
  const installedIds = new Set(installed.map((h) => h.category));
  const available = HOOK_CATEGORIES.filter((c) => !installedIds.has(c.id));
  if (available.length === 0) {
    dim('(todas instaladas)');
  } else {
    for (const cat of available) {
      raw(`    ${chalk.dim('○')} ${chalk.yellow(cat.id.padEnd(12))}${chalk.dim(cat.description)}`);
    }
  }
  raw('');
}
