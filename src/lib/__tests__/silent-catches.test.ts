import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Verifies that catches annotated as "expected" actually behave like the
 * comments claim: they don't crash, return sensible fallbacks, and emit a
 * [debug] line only when verbose is on. Ensures future refactors can't
 * silently regress back to swallow-and-hope behavior.
 */

describe('hooks.readSettings on corrupt JSON', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'claudiao-catch-'));
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../paths.js');
    vi.resetModules();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns {} without crashing when settings.json has invalid JSON', async () => {
    const settingsPath = join(tmp, 'settings.json');
    writeFileSync(settingsPath, '{ invalid json ');

    vi.doMock('../paths.js', () => ({
      CLAUDE_DIR: tmp,
      getTemplatesPath: () => join(tmp, 'templates'),
    }));

    const { readSettings } = await import('../hooks.js');
    expect(readSettings()).toEqual({});
  });
});

describe('paths.getExternalRepoPath on corrupt config', () => {
  let tmp: string;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'claudiao-paths-'));
    process.env.HOME = tmp;
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    vi.doUnmock('../paths.js');
    vi.resetModules();
  });

  afterEach(() => {
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;
    delete process.env.CLAUDIAO_DEBUG;
    vi.resetModules();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null without throwing when .claudiao.json is malformed', async () => {
    writeFileSync(join(tmp, '.claude', '.claudiao.json'), '{ not parseable');
    const { getExternalRepoPath } = await import('../paths.js');
    expect(getExternalRepoPath()).toBeNull();
  });

  it('emits a [debug] line only when verbose is on', async () => {
    writeFileSync(join(tmp, '.claude', '.claudiao.json'), '{ nope ');
    process.env.CLAUDIAO_DEBUG = '1';
    vi.resetModules();
    const { getExternalRepoPath } = await import('../paths.js');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getExternalRepoPath();
    expect(
      errSpy.mock.calls.some((c) =>
        String(c[0]).includes('getExternalRepoPath'),
      ),
    ).toBe(true);
    errSpy.mockRestore();
  });

  it('stays silent when verbose is off', async () => {
    writeFileSync(join(tmp, '.claude', '.claudiao.json'), '{ nope ');
    delete process.env.CLAUDIAO_DEBUG;
    vi.resetModules();
    const { getExternalRepoPath } = await import('../paths.js');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getExternalRepoPath();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('symlinks.isSymlink on missing path', () => {
  it('returns false without throwing for non-existent paths', async () => {
    const { isSymlink } = await import('../symlinks.js');
    expect(isSymlink('/definitely/does/not/exist/anywhere')).toBe(false);
  });
});

describe('symlinks.getSymlinkTarget on non-symlink', () => {
  it('returns null without throwing when given a regular file', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'claudiao-sym-'));
    const regular = join(tmp, 'regular.txt');
    writeFileSync(regular, 'hi');

    try {
      const { getSymlinkTarget } = await import('../symlinks.js');
      expect(getSymlinkTarget(regular)).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
