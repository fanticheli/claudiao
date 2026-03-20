import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function getSymlinkTarget(path: string): string | null {
  try {
    return readlinkSync(path);
  } catch {
    return null;
  }
}

export interface LinkResult {
  status: 'created' | 'updated' | 'skipped' | 'backup';
}

export function createSymlink(source: string, target: string): LinkResult {
  ensureDir(dirname(target));

  if (isSymlink(target)) {
    const currentTarget = getSymlinkTarget(target);
    // Resolve both to absolute paths to handle relative symlinks
    const resolvedCurrent = currentTarget ? resolve(dirname(target), currentTarget) : null;
    const resolvedSource = resolve(source);
    if (resolvedCurrent === resolvedSource) {
      return { status: 'skipped' };
    }
    rmSync(target);
    symlinkSync(source, target);
    return { status: 'updated' };
  }

  if (existsSync(target)) {
    renameSync(target, target + '.bak');
    symlinkSync(source, target);
    return { status: 'backup' };
  }

  symlinkSync(source, target);
  return { status: 'created' };
}

export function removeSymlink(path: string): boolean {
  if (isSymlink(path)) {
    rmSync(path);
    // Restore backup if exists
    if (existsSync(path + '.bak')) {
      renameSync(path + '.bak', path);
    }
    return true;
  }
  return false;
}
