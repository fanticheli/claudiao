import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, lstatSync, symlinkSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureDir, isSymlink, createSymlink, removeSymlink } from '../symlinks.js';

let tmpDir: string;

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeTmp(): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'claudiao-test-'));
  return tmpDir;
}

describe('ensureDir', () => {
  it('should create nested directories that do not exist', () => {
    const dir = join(makeTmp(), 'a', 'b', 'c');
    expect(existsSync(dir)).toBe(false);

    ensureDir(dir);

    expect(existsSync(dir)).toBe(true);
  });

  it('should not throw when directory already exists', () => {
    const dir = makeTmp();
    expect(() => ensureDir(dir)).not.toThrow();
  });
});

describe('isSymlink', () => {
  it('should return true for a symlink', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.txt');
    const link = join(dir, 'link.txt');
    writeFileSync(source, 'hello');
    symlinkSync(source, link);

    expect(isSymlink(link)).toBe(true);
  });

  it('should return false for a regular file', () => {
    const dir = makeTmp();
    const file = join(dir, 'file.txt');
    writeFileSync(file, 'hello');

    expect(isSymlink(file)).toBe(false);
  });

  it('should return false for a non-existent path', () => {
    expect(isSymlink('/tmp/does-not-exist-xyz-123')).toBe(false);
  });
});

describe('createSymlink', () => {
  it('should create a new symlink (status: created)', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.md');
    const target = join(dir, 'installed', 'agent.md');
    writeFileSync(source, '# Agent');

    const result = createSymlink(source, target);

    expect(result.status).toBe('created');
    expect(isSymlink(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('# Agent');
  });

  it('should skip if symlink already points to the same target (status: skipped)', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.md');
    const target = join(dir, 'link.md');
    writeFileSync(source, 'content');
    symlinkSync(source, target);

    const result = createSymlink(source, target);

    expect(result.status).toBe('skipped');
    expect(isSymlink(target)).toBe(true);
  });

  it('should update symlink pointing to a different target (status: updated)', () => {
    const dir = makeTmp();
    const oldSource = join(dir, 'old.md');
    const newSource = join(dir, 'new.md');
    const target = join(dir, 'link.md');
    writeFileSync(oldSource, 'old');
    writeFileSync(newSource, 'new');
    symlinkSync(oldSource, target);

    const result = createSymlink(newSource, target);

    expect(result.status).toBe('updated');
    expect(isSymlink(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('new');
  });

  it('should backup a non-symlink file before creating symlink (status: backup)', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.md');
    const target = join(dir, 'existing.md');
    writeFileSync(source, 'from source');
    writeFileSync(target, 'original content');

    const result = createSymlink(source, target);

    expect(result.status).toBe('backup');
    expect(isSymlink(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('from source');
    expect(existsSync(target + '.bak')).toBe(true);
    expect(readFileSync(target + '.bak', 'utf-8')).toBe('original content');
  });

  it('should create parent directories for the target', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.md');
    const target = join(dir, 'deep', 'nested', 'link.md');
    writeFileSync(source, 'data');

    createSymlink(source, target);

    expect(existsSync(join(dir, 'deep', 'nested'))).toBe(true);
    expect(isSymlink(target)).toBe(true);
  });
});

describe('removeSymlink', () => {
  it('should remove a symlink and return true', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.md');
    const link = join(dir, 'link.md');
    writeFileSync(source, 'content');
    symlinkSync(source, link);

    const removed = removeSymlink(link);

    expect(removed).toBe(true);
    expect(existsSync(link)).toBe(false);
  });

  it('should restore backup after removing symlink', () => {
    const dir = makeTmp();
    const source = join(dir, 'source.md');
    const target = join(dir, 'file.md');
    writeFileSync(source, 'new');
    writeFileSync(target, 'original');

    // createSymlink backs up the original file
    createSymlink(source, target);
    expect(existsSync(target + '.bak')).toBe(true);

    // removeSymlink restores the backup
    const removed = removeSymlink(target);

    expect(removed).toBe(true);
    expect(existsSync(target)).toBe(true);
    expect(isSymlink(target)).toBe(false);
    expect(readFileSync(target, 'utf-8')).toBe('original');
    expect(existsSync(target + '.bak')).toBe(false);
  });

  it('should return false for a non-symlink path', () => {
    const dir = makeTmp();
    const file = join(dir, 'regular.md');
    writeFileSync(file, 'content');

    expect(removeSymlink(file)).toBe(false);
  });

  it('should return false for a non-existent path', () => {
    expect(removeSymlink('/tmp/does-not-exist-xyz-456')).toBe(false);
  });
});
