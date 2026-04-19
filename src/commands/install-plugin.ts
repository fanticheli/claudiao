import chalk from 'chalk';
import { output } from '../lib/format.js';

export function installPlugin(_name?: string): void {
  output.warn(`O comando 'claudiao install plugin' foi removido na v1.4.0.`);
  output.raw('');
  output.info('O claudiao agora foca apenas em gerenciar os próprios agents, skills e hooks.');
  output.info('Pra instalar plugins do Claude Code (superpowers, claude-mem, etc.), use:');
  output.raw('');
  output.raw(`  ${chalk.cyan('claude /plugin install <nome-do-plugin>')}`);
  output.raw('');
  output.info('Documentação oficial: https://docs.claude.com/en/docs/claude-code/plugins');
  process.exit(1);
}
