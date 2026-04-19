import chalk from 'chalk';

// ============================================================
// Global output mode state
// ============================================================

/**
 * Verbose mode surfaces `[debug]` lines that explain runtime
 * decisions (path resolution, symlink sources, ignored catches).
 * Controlled by the `--verbose` / `-v` CLI flag or by the
 * `CLAUDIAO_DEBUG=1` env var.
 */
let verboseEnabled =
  process.env.CLAUDIAO_DEBUG === '1' ||
  process.env.CLAUDIAO_DEBUG === 'true';

let quietEnabled = false;
let jsonEnabled = false;

/** Turn verbose on or off; env var always wins if set. */
export function setVerbose(on: boolean): void {
  verboseEnabled =
    on ||
    process.env.CLAUDIAO_DEBUG === '1' ||
    process.env.CLAUDIAO_DEBUG === 'true';
}

export function isVerbose(): boolean {
  return verboseEnabled;
}

export function setQuiet(on: boolean): void {
  quietEnabled = on;
}

export function setJsonMode(on: boolean): void {
  jsonEnabled = on;
}

// ============================================================
// Individual write helpers
// ============================================================

export function banner(): void {
  if (quietEnabled || jsonEnabled) return;
  console.log('');
  console.log(chalk.blue('╔═══════════════════════════════════════════╗'));
  console.log(chalk.blue('║                                           ║'));
  console.log(chalk.blue('║   ') + chalk.bold('claudiao') + chalk.dim(' — Claude no próximo nível') + chalk.blue('        ║'));
  console.log(chalk.blue('║                                           ║'));
  console.log(chalk.blue('╚═══════════════════════════════════════════╝'));
  console.log('');
}

export function success(msg: string): void {
  if (quietEnabled || jsonEnabled) return;
  console.log(chalk.green('  ✓ ') + msg);
}

export function warn(msg: string): void {
  if (quietEnabled || jsonEnabled) return;
  console.log(chalk.yellow('  ⚠ ') + msg);
}

export function error(msg: string): void {
  if (jsonEnabled) {
    // In JSON mode, errors go to stderr to keep stdout clean.
    console.error(chalk.red('  ✗ ') + msg);
    return;
  }
  console.log(chalk.red('  ✗ ') + msg);
}

export function info(msg: string): void {
  if (quietEnabled || jsonEnabled) return;
  console.log(chalk.cyan('  ℹ ') + msg);
}

export function dim(msg: string): void {
  if (quietEnabled || jsonEnabled) return;
  console.log(chalk.dim('    ' + msg));
}

export function heading(msg: string): void {
  if (quietEnabled || jsonEnabled) return;
  console.log('');
  console.log(chalk.bold(msg));
  console.log('');
}

export function separator(): void {
  if (quietEnabled || jsonEnabled) return;
  console.log('');
  console.log(chalk.blue('═══════════════════════════════════════════'));
  console.log('');
}

export function debug(msg: string): void {
  if (!verboseEnabled) return;
  if (jsonEnabled) return; // debug never polutes JSON stdout
  console.error(chalk.dim(`  [debug] ${msg}`));
}

export function raw(msg: string): void {
  if (quietEnabled || jsonEnabled) return;
  console.log(msg);
}

export function table(
  rows: Array<{ name: string; description: string; status?: string; source?: string }>,
): void {
  if (quietEnabled || jsonEnabled) return;
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

/**
 * Emit structured JSON output. Always writes to stdout, regardless of
 * verbose/quiet state, because JSON consumers need a clean machine
 * readable stream.
 */
export function json(data: unknown): void {
  console.log(JSON.stringify(data));
}

// ============================================================
// Aggregated namespace
// ============================================================

/**
 * Grouped access to every output primitive. Prefer this over direct
 * function imports in command modules — it's easier to mock in tests
 * and makes the "this is user-facing output" intent obvious.
 */
export const output = {
  banner,
  success,
  warn,
  error,
  info,
  dim,
  heading,
  separator,
  debug,
  raw,
  table,
  json,
};
