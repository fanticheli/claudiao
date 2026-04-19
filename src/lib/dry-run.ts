import { info } from './format.js';

export interface DryRunContext {
  dryRun: boolean;
}

/**
 * Runs `action` unless `ctx.dryRun` is true, in which case prints a
 * `[dry-run] <message>` line and returns `undefined`. Centralizes the
 * if/else pattern that was duplicated across init, update and remove.
 *
 * The action is invoked only when not in dry-run — exceptions propagate
 * so callers still get real failures. Supports both sync and async
 * actions via the generic return type.
 */
export function dryRunnable<T>(
  ctx: DryRunContext,
  action: () => T,
  dryMessage: string,
): T | undefined {
  if (ctx.dryRun) {
    info(`[dry-run] ${dryMessage}`);
    return undefined;
  }
  return action();
}
