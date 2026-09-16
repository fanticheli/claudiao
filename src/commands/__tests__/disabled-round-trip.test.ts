import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../../lib/paths.js', () => ({
  get CLAUDE_AGENTS_DIR() {
    return AGENTS_DIR;
  },
  get CLAUDE_SKILLS_DIR() {
    return SKILLS_DIR;
  },
  get CLAUDE_COMMANDS_DIR() {
    return COMMANDS_DIR;
  },
  get CONFIG_FILE() {
    return CONFIG_FILE;
  },
  getAgentsSource: () => TEMPLATE_AGENTS,
  getSkillsSource: () => TEMPLATE_SKILLS,
  getCommandsSource: () => null,
  getGlobalMdSource: () => null,
  getExternalRepoPath: () => null,
  get CLAUDE_DIR() {
    return join(tmpRoot, 'claude');
  },
  get CLAUDE_MD() {
    return join(tmpRoot, 'claude', 'CLAUDE.md');
  },
}));

vi.mock('../../lib/package-info.js', () => ({ getPackageVersion: () => '9.9.9' }));

vi.mock('inquirer', () => ({ default: { prompt: () => Promise.resolve({ wantStatusline: false }) } }));

vi.mock('../../lib/attribution.js', () => ({
  isAttributionDisabled: () => true,
  disableAttribution: () => false,
}));

let tmpRoot = '';
let AGENTS_DIR = '';
let SKILLS_DIR = '';
let COMMANDS_DIR = '';
let CONFIG_FILE = '';
let TEMPLATE_AGENTS = '';
let TEMPLATE_SKILLS = '';

const agentBody = '---\nname: gcp-specialist\ndescription: x\n---\nbody';

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-round-trip-'));
  AGENTS_DIR = join(tmpRoot, 'claude', 'agents');
  SKILLS_DIR = join(tmpRoot, 'claude', 'skills');
  COMMANDS_DIR = join(tmpRoot, 'claude', 'commands');
  CONFIG_FILE = join(tmpRoot, 'claude', '.claudiao.json');
  TEMPLATE_AGENTS = join(tmpRoot, 'templates', 'agents');
  TEMPLATE_SKILLS = join(tmpRoot, 'templates', 'skills');
  mkdirSync(AGENTS_DIR, { recursive: true });
  mkdirSync(TEMPLATE_AGENTS, { recursive: true });
  mkdirSync(TEMPLATE_SKILLS, { recursive: true });
  writeFileSync(join(TEMPLATE_AGENTS, 'gcp-specialist.md'), agentBody);
  writeFileSync(join(TEMPLATE_AGENTS, 'nodejs-specialist.md'), agentBody.replace('gcp-specialist', 'nodejs-specialist'));
});

afterEach(() => {
  if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  vi.resetModules();
});

describe('a disabled item stays disabled across update and init', () => {
  it('update does not relink what was disabled', async () => {
    const { disable } = await import('../../lib/disabled.js');
    const { update } = await import('../update.js');

    disable('agents', 'gcp-specialist');
    update();

    expect(existsSync(join(AGENTS_DIR, 'gcp-specialist.md'))).toBe(false);
    expect(existsSync(join(AGENTS_DIR, 'nodejs-specialist.md'))).toBe(true);
  });

  it('init keeps the disabled list instead of wiping the config, and update after it stays clean', async () => {
    const { disable, disabledNames } = await import('../../lib/disabled.js');
    disable('agents', 'gcp-specialist');

    const { init } = await import('../init.js');
    await init();

    expect([...disabledNames('agents')]).toEqual(['gcp-specialist']);
    expect(JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')).version).toBe('9.9.9');
    expect(existsSync(join(AGENTS_DIR, 'gcp-specialist.md'))).toBe(false);

    const { update } = await import('../update.js');
    update();
    expect(existsSync(join(AGENTS_DIR, 'gcp-specialist.md'))).toBe(false);
  });

  it('update --force does not resurrect a disabled agent either', async () => {
    const { disable } = await import('../../lib/disabled.js');
    const { update } = await import('../update.js');

    disable('agents', 'gcp-specialist');
    update({ force: true });

    expect(existsSync(join(AGENTS_DIR, 'gcp-specialist.md'))).toBe(false);
  });
});
