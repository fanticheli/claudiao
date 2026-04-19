#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { createAgent, createSkill } from './commands/create.js';
import { listAgents, listSkills, listPlugins } from './commands/list.js';
import { doctor } from './commands/doctor.js';
import { removeAgent, removeSkill } from './commands/remove.js';
import { update } from './commands/update.js';
import { installPlugin } from './commands/install-plugin.js';
import { installHooks, uninstallHooks, listHooks } from './commands/hooks.js';
import { getPackageVersion } from './lib/package-info.js';
import { setVerbose, debug } from './lib/format.js';

const program = new Command();

program
  .name('claudiao')
  .description('Seu Claude Code no próximo nível. Agentes, skills e plugins em um comando.')
  .version(getPackageVersion())
  .option('-v, --verbose', 'Mostra logs de diagnóstico ([debug]) pra depurar decisões internas')
  .hook('preAction', (thisCommand) => {
    const rootOpts = thisCommand.optsWithGlobals?.() ?? thisCommand.opts();
    if (rootOpts.verbose) {
      setVerbose(true);
      debug(`verbose mode ON (flag: --verbose)`);
    } else if (process.env.CLAUDIAO_DEBUG === '1' || process.env.CLAUDIAO_DEBUG === 'true') {
      debug(`verbose mode ON (env: CLAUDIAO_DEBUG=${process.env.CLAUDIAO_DEBUG})`);
    }
  });

// ============================================================
// init
// ============================================================
program
  .command('init')
  .description('Configura tudo: instala agentes, skills, CLAUDE.md global e plugins opcionais')
  .option('--dry-run', 'Mostra o que seria feito sem executar')
  .action(async (options: { dryRun?: boolean }) => {
    await init(options);
  });

// ============================================================
// create
// ============================================================
const create = program
  .command('create')
  .description('Cria um novo agente ou skill');

create
  .command('agent [description]')
  .description('Cria um novo agente especializado a partir de uma descricao')
  .addHelpText('after', `
Exemplos:
  claudiao create agent
  claudiao create agent "Especialista em Go com foco em microservices e gRPC"
  claudiao create agent "Agente de DevOps focado em Kubernetes e Helm charts"
  `)
  .action(async (description?: string) => {
    await createAgent(description);
  });

create
  .command('skill [description]')
  .description('Cria uma nova skill (slash command) com template/checklist')
  .addHelpText('after', `
Exemplos:
  claudiao create skill
  claudiao create skill "Checklist de deploy para producao"
  claudiao create skill "Template de postmortem de incidente"
  `)
  .action(async (description?: string) => {
    await createSkill(description);
  });

// ============================================================
// list
// ============================================================
const list = program
  .command('list')
  .description('Lista agentes, skills ou plugins');

list
  .command('agents')
  .description('Lista todos os agentes instalados com descricao e categoria')
  .action(() => {
    listAgents();
  });

list
  .command('skills')
  .description('Lista todas as skills instaladas (slash commands)')
  .action(() => {
    listSkills();
  });

list
  .command('plugins')
  .description('Lista plugins da comunidade disponiveis')
  .action(() => {
    listPlugins();
  });

// ============================================================
// install plugin
// ============================================================
program
  .command('install')
  .description('Instala um plugin da comunidade')
  .argument('<type>', 'Tipo: plugin')
  .argument('<name>', 'Nome do plugin (superpowers, get-shit-done, claude-mem)')
  .addHelpText('after', `
Exemplos:
  claudiao install plugin superpowers
  claudiao install plugin get-shit-done
  claudiao install plugin claude-mem
  `)
  .action((type: string, name: string) => {
    if (type !== 'plugin') {
      console.log(`Tipo "${type}" nao reconhecido. Use: claudiao install plugin <nome>`);
      return;
    }
    installPlugin(name);
  });

// ============================================================
// remove
// ============================================================
const remove = program
  .command('remove')
  .description('Remove um agente ou skill');

remove
  .command('agent <name>')
  .description('Remove um agente instalado')
  .option('--dry-run', 'Mostra o que seria feito sem executar')
  .action(async (name: string, options: { dryRun?: boolean }) => {
    await removeAgent(name, options);
  });

remove
  .command('skill <name>')
  .description('Remove uma skill instalada')
  .option('--dry-run', 'Mostra o que seria feito sem executar')
  .action(async (name: string, options: { dryRun?: boolean }) => {
    await removeSkill(name, options);
  });

// ============================================================
// update
// ============================================================
program
  .command('update')
  .description('Atualiza agentes e skills do repositorio (git pull + relink)')
  .option('--force', 'Re-linka todos os agentes e skills, nao apenas novos')
  .option('--dry-run', 'Mostra o que seria feito sem executar')
  .action((options: { force?: boolean; dryRun?: boolean }) => {
    update(options);
  });

// ============================================================
// doctor
// ============================================================
program
  .command('doctor')
  .description('Verifica se tudo esta instalado e funcionando corretamente')
  .action(() => {
    doctor();
  });

// ============================================================
// hooks
// ============================================================
const hooks = program
  .command('hooks')
  .description('Gerencia hooks do claudiao que lembram skills em momentos criticos');

hooks
  .command('install')
  .description('Instala hooks que lembram /security-checklist, /ui-review-checklist, etc')
  .option('--only <categories>', 'Instala apenas categorias especificas (ex: security,ui)')
  .option('--dry-run', 'Mostra o que seria feito sem executar')
  .addHelpText('after', `
Exemplos:
  claudiao hooks install
  claudiao hooks install --only security,migration
  claudiao hooks install --dry-run
  `)
  .action(async (options: { only?: string; dryRun?: boolean }) => {
    await installHooks(options);
  });

hooks
  .command('uninstall')
  .description('Remove hooks do claudiao de settings.json (preserva hooks de outros plugins)')
  .option('-y, --yes', 'Pula confirmacao interativa')
  .option('--only <categories>', 'Remove apenas categorias especificas (ex: ui,migration)')
  .addHelpText('after', `
Exemplos:
  claudiao hooks uninstall
  claudiao hooks uninstall --only ui
  claudiao hooks uninstall --only ui,migration --yes
  `)
  .action(async (options: { yes?: boolean; only?: string }) => {
    await uninstallHooks(options);
  });

hooks
  .command('list')
  .description('Lista hooks do claudiao atualmente instalados')
  .action(() => {
    listHooks();
  });

// ============================================================
// Parse
// ============================================================
try {
  await program.parseAsync();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n  \x1b[31m✗\x1b[0m Erro inesperado: ${message}\n`);
  process.exit(1);
}
