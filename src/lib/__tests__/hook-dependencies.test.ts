import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { HOOK_CATEGORIES } from '../hooks.js';

const TEMPLATES_HOOKS = join(process.cwd(), 'templates', 'hooks');
const RELATIVE_IMPORT = /from\s+'(\.\/[^']+)'/g;

function relativeImports(file: string): string[] {
  const source = readFileSync(join(TEMPLATES_HOOKS, file), 'utf-8');
  const base = dirname(file);
  return [...source.matchAll(RELATIVE_IMPORT)].map((match) => join(base, match[1]).replace(/^\.\//, ''));
}

function transitiveImports(entry: string, seen = new Set<string>()): string[] {
  for (const imported of relativeImports(entry)) {
    if (seen.has(imported)) continue;
    seen.add(imported);
    transitiveImports(imported, seen);
  }
  return [...seen];
}

describe('every bundled hook installs the files it imports', () => {
  for (const category of HOOK_CATEGORIES) {
    it(`${category.id} declares its imports in extraFiles`, () => {
      const declared = new Set([category.script, ...(category.extraFiles ?? [])]);
      for (const imported of transitiveImports(category.script)) {
        expect(declared.has(imported), `${category.script} imports ${imported}`).toBe(true);
      }
    });
  }

  it('every declared file exists in templates/hooks', () => {
    for (const category of HOOK_CATEGORIES) {
      for (const file of [category.script, ...(category.extraFiles ?? [])]) {
        expect(existsSync(join(TEMPLATES_HOOKS, file)), file).toBe(true);
      }
    }
  });

  it('a hook that imports a lib which imports another lib declares both', () => {
    const libraries = new Set(HOOK_CATEGORIES.flatMap((category) => category.extraFiles ?? []));
    for (const library of libraries) {
      for (const imported of transitiveImports(library)) {
        expect(existsSync(join(TEMPLATES_HOOKS, imported)), `${library} imports ${imported}`).toBe(true);
      }
    }
  });
});
