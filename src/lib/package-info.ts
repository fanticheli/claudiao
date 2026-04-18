import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from './paths.js';

interface PackageJson {
  version?: string;
  name?: string;
}

let cached: PackageJson | null = null;

function readPackageJson(): PackageJson {
  if (cached) return cached;
  const raw = readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8');
  cached = JSON.parse(raw) as PackageJson;
  return cached;
}

export function getPackageVersion(): string {
  const pkg = readPackageJson();
  if (!pkg.version) {
    throw new Error('package.json sem campo `version`');
  }
  return pkg.version;
}

export function getPackageName(): string {
  const pkg = readPackageJson();
  return pkg.name ?? 'claudiao';
}
