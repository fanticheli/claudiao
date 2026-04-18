import chalk from 'chalk';

export function banner(): void {
  console.log('');
  console.log(chalk.blue('╔═══════════════════════════════════════════╗'));
  console.log(chalk.blue('║                                           ║'));
  console.log(chalk.blue('║   ') + chalk.bold('claudiao') + chalk.dim(' — Claude no próximo nível') + chalk.blue('        ║'));
  console.log(chalk.blue('║                                           ║'));
  console.log(chalk.blue('╚═══════════════════════════════════════════╝'));
  console.log('');
}

export function success(msg: string): void {
  console.log(chalk.green('  ✓ ') + msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow('  ⚠ ') + msg);
}

export function error(msg: string): void {
  console.log(chalk.red('  ✗ ') + msg);
}

export function info(msg: string): void {
  console.log(chalk.cyan('  ℹ ') + msg);
}

export function dim(msg: string): void {
  console.log(chalk.dim('    ' + msg));
}

export function heading(msg: string): void {
  console.log('');
  console.log(chalk.bold(msg));
  console.log('');
}

export function separator(): void {
  console.log('');
  console.log(chalk.blue('═══════════════════════════════════════════'));
  console.log('');
}

export function table(
  rows: Array<{ name: string; description: string; status?: string; source?: string }>,
): void {
  const maxName = Math.max(...rows.map((r) => r.name.length), 4);
  const hasSource = rows.some((r) => r.source);
  const maxSource = hasSource
    ? Math.max(...rows.map((r) => (r.source ?? '').length), 6)
    : 0;

  for (const row of rows) {
    const name = row.name.padEnd(maxName + 2);
    const source = hasSource
      ? chalk.dim(`[${(row.source ?? '').padEnd(maxSource)}] `)
      : '';
    const status = row.status
      ? row.status === 'installed'
        ? chalk.green(' [instalado]')
        : chalk.dim(' [não instalado]')
      : '';
    console.log(`  ${chalk.cyan(name)}${source}${chalk.dim(row.description)}${status}`);
  }
}
