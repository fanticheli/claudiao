import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { getPlugin, PLUGINS } from '../lib/plugins.js';
import { banner, success, error, heading, info } from '../lib/format.js';

export function installPlugin(name: string): void {
  banner();

  const plugin = getPlugin(name);

  if (!plugin) {
    error(`Plugin "${name}" nao encontrado.`);
    console.log('');
    info('Plugins disponiveis:');
    for (const p of PLUGINS) {
      console.log(`  ${chalk.cyan(p.name.padEnd(18))}${chalk.dim(p.description.slice(0, 60))}`);
    }
    console.log('');
    return;
  }

  heading(`Instalando ${plugin.name}...`);
  console.log(chalk.dim(`  ${plugin.description}`));
  console.log(chalk.dim(`  Repo: ${plugin.repo}`));
  console.log('');
  console.log(chalk.dim(`  Executando: ${plugin.installCommand}`));
  console.log('');

  try {
    execSync(plugin.installCommand, { stdio: 'inherit' });
    console.log('');
    success(`${plugin.name} instalado!`);
  } catch {
    console.log('');
    error(`Falha ao instalar ${plugin.name}.`);
    info(`Tente manualmente: ${chalk.yellow(plugin.installCommand)}`);
  }
  console.log('');
}
