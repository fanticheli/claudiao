import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../paths.js', async () => ({
  CLAUDE_DIR: '',
  getTemplatesPath: () => TEMPLATES_DIR,
}));

let CLAUDE_DIR_OVERRIDE = '';
let TEMPLATES_DIR = '';
let tmpRoot = '';

async function importRules() {
  const paths = await import('../paths.js');
  // @ts-expect-error test override
  paths.CLAUDE_DIR = CLAUDE_DIR_OVERRIDE;
  return import('../rules.js');
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-rules-'));
  CLAUDE_DIR_OVERRIDE = join(tmpRoot, 'claude');
  TEMPLATES_DIR = join(tmpRoot, 'templates');
  mkdirSync(join(TEMPLATES_DIR, 'rules'), { recursive: true });
  writeFileSync(join(TEMPLATES_DIR, 'rules', 'code-standards.md'), 'regra nova\n');
});

afterEach(() => {
  if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  vi.resetModules();
});

describe('global rules install', () => {
  it('installs a rule that is not there yet', async () => {
    const { availableRules, installRules, RULES_DIR } = await importRules();
    const installed = installRules(availableRules(), false);
    expect(installed).toHaveLength(1);
    expect(readFileSync(join(RULES_DIR, 'code-standards.md'), 'utf-8')).toBe('regra nova\n');
  });

  it('never overwrites a rule the user edited unless forced', async () => {
    const { availableRules, installRules, RULES_DIR } = await importRules();
    mkdirSync(RULES_DIR, { recursive: true });
    writeFileSync(join(RULES_DIR, 'code-standards.md'), 'minha versao\n');

    expect(availableRules()[0].state).toBe('different');
    expect(installRules(availableRules(), false)).toHaveLength(0);
    expect(readFileSync(join(RULES_DIR, 'code-standards.md'), 'utf-8')).toBe('minha versao\n');

    expect(installRules(availableRules(), true)).toHaveLength(1);
    expect(readFileSync(join(RULES_DIR, 'code-standards.md'), 'utf-8')).toBe('regra nova\n');
  });

  it('reports an already installed rule as identical and rewrites nothing', async () => {
    const { availableRules, installRules } = await importRules();
    installRules(availableRules(), false);
    expect(availableRules()[0].state).toBe('identical');
    expect(installRules(availableRules(), false)).toHaveLength(0);
  });
});
