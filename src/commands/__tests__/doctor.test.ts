import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpRoot = '';
const claudeDir = () => join(tmpRoot, 'claude');

vi.mock('../../lib/paths.js', () => ({
  get CLAUDE_DIR() {
    return claudeDir();
  },
  get CLAUDE_AGENTS_DIR() {
    return join(claudeDir(), 'agents');
  },
  get CLAUDE_SKILLS_DIR() {
    return join(claudeDir(), 'skills');
  },
  get CLAUDE_COMMANDS_DIR() {
    return join(claudeDir(), 'commands');
  },
  get CLAUDE_MD() {
    return join(claudeDir(), 'CLAUDE.md');
  },
  get CONFIG_FILE() {
    return join(claudeDir(), '.claudiao.json');
  },
  getAgentsSource: () => null,
  getExternalRepoPath: () => null,
}));

vi.mock('../../lib/rules.js', () => ({
  get RULES_DIR() {
    return join(claudeDir(), 'rules');
  },
}));

vi.mock('../../lib/hooks.js', () => ({ readSettings: () => ({}) }));

const { doctor } = await import('../doctor.js');

function runDoctor(): string {
  const lines: string[] = [];
  const capture = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  const log = vi.spyOn(console, 'log').mockImplementation(capture);
  const err = vi.spyOn(console, 'error').mockImplementation(capture);
  const warn = vi.spyOn(console, 'warn').mockImplementation(capture);
  try {
    doctor();
  } finally {
    log.mockRestore();
    err.mockRestore();
    warn.mockRestore();
  }
  return lines.join('\n');
}

describe('doctor', () => {
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-doctor-'));
    for (const dir of ['agents', 'skills', 'commands']) mkdirSync(join(claudeDir(), dir), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('accepts global rules in place of the global CLAUDE.md', () => {
    mkdirSync(join(claudeDir(), 'rules'));
    writeFileSync(join(claudeDir(), 'rules', 'code-standards.md'), '# rules\n');
    const output = runDoctor();
    expect(output).toContain('Regras globais em');
    expect(output).not.toContain('CLAUDE.md global nao instalado');
  });

  it('still warns when there is neither a global CLAUDE.md nor global rules', () => {
    expect(runDoctor()).toContain('CLAUDE.md global nao instalado');
  });

  it('ignores the skills directory managed by Claude Code', () => {
    mkdirSync(join(claudeDir(), 'skills', 'synced', 'some-uuid'), { recursive: true });
    expect(runDoctor()).not.toContain('Skill synced');
  });
});
