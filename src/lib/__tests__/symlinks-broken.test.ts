import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { isSymlinkBroken, resolveSymlinkTarget } from '../symlinks.js';

const isPosix = process.platform !== 'win32';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = mkdtempSync(join(tmpdir(), 'claudiao-doctor-'));
});

afterEach(() => {
  process.chdir(originalCwd);
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('isSymlinkBroken — regression from v1.2.0', () => {
  it.skipIf(!isPosix)('returns false for a relative symlink pointing to an existing file', () => {
    const source = join(tmpDir, 'source.md');
    const linkDir = join(tmpDir, 'installed');
    const link = join(linkDir, 'agent.md');
    mkdirSync(linkDir);
    writeFileSync(source, '# Agent');
    const rel = relative(dirname(link), source);
    symlinkSync(rel, link);

    expect(isSymlinkBroken(link)).toBe(false);
  });

  it('returns false for an absolute symlink pointing to an existing file', () => {
    const source = join(tmpDir, 'source.md');
    const link = join(tmpDir, 'link.md');
    writeFileSync(source, '# Agent');
    symlinkSync(source, link);

    expect(isSymlinkBroken(link)).toBe(false);
  });

  it('returns true for a symlink pointing to a nonexistent file', () => {
    const link = join(tmpDir, 'dangling.md');
    symlinkSync(join(tmpDir, 'does-not-exist.md'), link);

    expect(isSymlinkBroken(link)).toBe(true);
  });

  it.skipIf(!isPosix)('returns true for a relative symlink pointing to a nonexistent file', () => {
    const linkDir = join(tmpDir, 'installed');
    mkdirSync(linkDir);
    const link = join(linkDir, 'dangling.md');
    symlinkSync('../missing.md', link);

    expect(isSymlinkBroken(link)).toBe(true);
  });

  it.skipIf(!isPosix)('is not affected by process CWD — relative links resolve against their directory', () => {
    // The exact regression: doctor.ts used to do existsSync(readlinkSync(path)),
    // which resolves the relative target against process.cwd() instead of the
    // symlink's directory. Running doctor from a different cwd produced bogus
    // "broken symlink" reports for valid installs.
    const source = join(tmpDir, 'source.md');
    const linkDir = join(tmpDir, 'installed');
    const link = join(linkDir, 'agent.md');
    mkdirSync(linkDir);
    writeFileSync(source, '# Agent');
    symlinkSync(relative(dirname(link), source), link);

    // Switch to an unrelated cwd — the answer must not depend on it.
    const otherCwd = mkdtempSync(join(tmpdir(), 'claudiao-cwd-'));
    try {
      process.chdir(otherCwd);
      expect(isSymlinkBroken(link)).toBe(false);
    } finally {
      process.chdir(originalCwd);
      rmSync(otherCwd, { recursive: true, force: true });
    }
  });

  it('returns false for a regular (non-symlink) file', () => {
    const file = join(tmpDir, 'regular.md');
    writeFileSync(file, 'x');

    expect(isSymlinkBroken(file)).toBe(false);
  });

  it('returns false for a missing path that is not a symlink', () => {
    expect(isSymlinkBroken(join(tmpDir, 'nope.md'))).toBe(false);
  });
});

describe('resolveSymlinkTarget', () => {
  it.skipIf(!isPosix)('resolves a relative target against the symlink directory', () => {
    const source = join(tmpDir, 'source.md');
    const linkDir = join(tmpDir, 'installed');
    const link = join(linkDir, 'agent.md');
    mkdirSync(linkDir);
    writeFileSync(source, 'x');
    symlinkSync('../source.md', link);

    expect(resolveSymlinkTarget(link)).toBe(source);
  });

  it('returns an absolute target unchanged', () => {
    const source = join(tmpDir, 'source.md');
    const link = join(tmpDir, 'link.md');
    writeFileSync(source, 'x');
    symlinkSync(source, link);

    expect(resolveSymlinkTarget(link)).toBe(source);
  });

  it('returns null for a non-symlink path', () => {
    const file = join(tmpDir, 'regular.md');
    writeFileSync(file, 'x');

    expect(resolveSymlinkTarget(file)).toBeNull();
  });
});
