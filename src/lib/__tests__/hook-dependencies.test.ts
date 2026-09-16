import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { HOOK_CATEGORIES } from '../hooks.js';

const TEMPLATES_HOOKS = join(process.cwd(), 'templates', 'hooks');
const RELATIVE_IMPORT = /from\s+'(\.\/[^']+)'/g;

function relativeImports(script: string): string[] {
  const source = readFileSync(join(TEMPLATES_HOOKS, script), 'utf-8');
  return [...source.matchAll(RELATIVE_IMPORT)].map((match) => match[1].replace(/^\.\//, ''));
}

describe('every bundled hook installs the files it imports', () => {
  for (const category of HOOK_CATEGORIES) {
    it(`${category.id} declares its imports in extraFiles`, () => {
      const declared = new Set([category.script, ...(category.extraFiles ?? [])]);
      for (const imported of relativeImports(category.script)) {
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

  it('shared libraries do not import other hooks', () => {
    const libraries = new Set(HOOK_CATEGORIES.flatMap((category) => category.extraFiles ?? []));
    for (const library of libraries) {
      const source = readFileSync(join(TEMPLATES_HOOKS, library), 'utf-8');
      const imports = [...source.matchAll(RELATIVE_IMPORT)].map((match) => match[1]);
      for (const imported of imports) {
        expect(existsSync(join(dirname(join(TEMPLATES_HOOKS, library)), imported)), `${library} imports ${imported}`).toBe(true);
      }
    }
  });
});
