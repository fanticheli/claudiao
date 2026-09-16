import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../paths.js', async () => ({
  CONFIG_FILE: '',
}));

let CONFIG_OVERRIDE = '';
let tmpRoot = '';

async function importDisabled() {
  const paths = await import('../paths.js');
  // @ts-expect-error test override
  paths.CONFIG_FILE = CONFIG_OVERRIDE;
  return import('../disabled.js');
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-disabled-'));
  CONFIG_OVERRIDE = join(tmpRoot, '.claudiao.json');
});

afterEach(() => {
  if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  vi.resetModules();
});

describe('disabled list in .claudiao.json', () => {
  it('starts empty when there is no config file', async () => {
    const { disabledNames, isDisabled } = await importDisabled();
    expect([...disabledNames('agents')]).toEqual([]);
    expect(isDisabled('agents', 'gcp-specialist')).toBe(false);
  });

  it('records a disabled item and reports it', async () => {
    const { disable, isDisabled } = await importDisabled();
    expect(disable('agents', 'gcp-specialist')).toBe(true);
    expect(disable('agents', 'gcp-specialist')).toBe(false);
    expect(isDisabled('agents', 'gcp-specialist')).toBe(true);
    expect(isDisabled('skills', 'gcp-specialist')).toBe(false);
  });

  it('keeps the other fields of the config file', async () => {
    writeFileSync(CONFIG_OVERRIDE, JSON.stringify({ installedAt: '2026-03-20', version: '1.8.0', repoPath: '/repo' }));
    const { disable } = await importDisabled();
    disable('skills', 'pm-templates');
    const saved = JSON.parse(readFileSync(CONFIG_OVERRIDE, 'utf-8'));
    expect(saved.installedAt).toBe('2026-03-20');
    expect(saved.repoPath).toBe('/repo');
    expect(saved.disabled.skills).toEqual(['pm-templates']);
  });

  it('enable removes the item and tells whether it was there', async () => {
    const { disable, enable, isDisabled } = await importDisabled();
    disable('commands', 'eod');
    expect(enable('commands', 'eod')).toBe(true);
    expect(enable('commands', 'eod')).toBe(false);
    expect(isDisabled('commands', 'eod')).toBe(false);
  });

  it('survives a corrupt or non-object config instead of crashing', async () => {
    writeFileSync(CONFIG_OVERRIDE, '{ not json');
    const { disabledNames, disable } = await importDisabled();
    expect([...disabledNames('agents')]).toEqual([]);
    expect(disable('agents', 'x')).toBe(true);
    expect(JSON.parse(readFileSync(CONFIG_OVERRIDE, 'utf-8')).disabled.agents).toEqual(['x']);
  });

  it('does not corrupt a hand-written list that is not an array', async () => {
    writeFileSync(CONFIG_OVERRIDE, JSON.stringify({ disabled: { agents: 'gcp-specialist' } }));
    const { disable } = await importDisabled();
    expect(disable('agents', 'azure-specialist')).toBe(true);
    expect(JSON.parse(readFileSync(CONFIG_OVERRIDE, 'utf-8')).disabled.agents).toEqual(['azure-specialist']);

    writeFileSync(CONFIG_OVERRIDE, JSON.stringify({ disabled: { agents: 42 } }));
    const fresh = await importDisabled();
    expect(() => fresh.disable('agents', 'azure-specialist')).not.toThrow();
  });

  it('ignores non-string entries written by hand', async () => {
    writeFileSync(CONFIG_OVERRIDE, JSON.stringify({ disabled: { agents: ['ok', 42, null] } }));
    const { disabledNames } = await importDisabled();
    expect([...disabledNames('agents')]).toEqual(['ok']);
  });
});
