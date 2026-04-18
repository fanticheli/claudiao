import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPackageVersion, getPackageName } from '../package-info.js';
import { PACKAGE_ROOT } from '../paths.js';

const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'));

describe('getPackageVersion', () => {
  it('returns the version from package.json', () => {
    expect(getPackageVersion()).toBe(pkg.version);
  });

  it('returns a semver-looking string', () => {
    expect(getPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('getPackageName', () => {
  it('returns claudiao', () => {
    expect(getPackageName()).toBe('claudiao');
  });
});
