import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { getPlugin, PLUGINS } from '../lib/plugins.js';
import { banner, success, error, heading, info, raw } from '../lib/format.js';

export function installPlugin(name: string): void {
  banner();

  const plugin = getPlugin(name);

  if (!plugin) {
    error(`Plugin "${name}" nao encontrado.`);
    raw('');
    info('Plugins disponiveis:');
    for (const p of PLUGINS) {
      raw(`  ${chalk.cyan(p.name.padEnd(18))}${chalk.dim(p.description.slice(0, 60))}`);
    }
    raw('');
    return;
  }

  heading(`Instalando ${plugin.name}...`);
  raw(chalk.dim(`  ${plugin.description}`));
  raw(chalk.dim(`  Repo: ${plugin.repo}`));
  raw('');
  raw(chalk.dim(`  Executando: ${plugin.installCommand}`));
  raw('');

  try {
    execSync(plugin.installCommand, { stdio: 'inherit' });
    raw('');
    success(`${plugin.name} instalado!`);
  } catch {
    raw('');
    error(`Falha ao instalar ${plugin.name}.`);
    info(`Tente manualmente: ${chalk.yellow(plugin.installCommand)}`);
  }
  raw('');
}
