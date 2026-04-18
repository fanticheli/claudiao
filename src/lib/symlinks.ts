import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

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

/**
 * Builds the link path stored in the symlink. On POSIX we use a path
 * relative to the symlink location so installs survive node_modules
 * relocations (BUG-002). On Windows, absolute paths are required for
 * junctions and more reliable for file symlinks.
 */
function buildLinkPath(source: string, target: string): string {
  if (process.platform === 'win32') {
    return resolve(source);
  }
  return relative(dirname(target), resolve(source));
}

export interface LinkResult {
  status: 'created' | 'updated' | 'skipped' | 'backup';
}

export function createSymlink(source: string, target: string): LinkResult {
  ensureDir(dirname(target));
  const linkPath = buildLinkPath(source, target);

  if (isSymlink(target)) {
    const currentTarget = getSymlinkTarget(target);
    // Resolve both to absolute paths to handle relative symlinks
    const resolvedCurrent = currentTarget
      ? isAbsolute(currentTarget)
        ? currentTarget
        : resolve(dirname(target), currentTarget)
      : null;
    const resolvedSource = resolve(source);
    if (resolvedCurrent === resolvedSource) {
      // Already points to the right place, but may still be absolute
      // (legacy from v1.1 and earlier). Rewrite as relative for portability.
      if (process.platform !== 'win32' && currentTarget && isAbsolute(currentTarget)) {
        rmSync(target);
        symlinkSync(linkPath, target);
        return { status: 'updated' };
      }
      return { status: 'skipped' };
    }
    rmSync(target);
    symlinkSync(linkPath, target);
    return { status: 'updated' };
  }

  if (existsSync(target)) {
    renameSync(target, target + '.bak');
    symlinkSync(linkPath, target);
    return { status: 'backup' };
  }

  symlinkSync(linkPath, target);
  return { status: 'created' };
}

/**
 * Returns the source type of an installed symlink. Distinguishes items
 * that ship with the claudiao package from items linked out of an
 * external user-managed repo, and from files the user created manually
 * (no symlink at all).
 */
export type InstallSource = 'core' | 'external' | 'local';

export function getInstallSource(linkPath: string, packageRoot: string): InstallSource {
  if (!isSymlink(linkPath)) return 'local';
  const target = getSymlinkTarget(linkPath);
  if (!target) return 'local';
  const absoluteTarget = isAbsolute(target) ? target : resolve(dirname(linkPath), target);
  const resolvedRoot = resolve(packageRoot);
  return absoluteTarget.startsWith(resolvedRoot) ? 'core' : 'external';
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
