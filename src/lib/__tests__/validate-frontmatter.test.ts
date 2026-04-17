import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateAgentFrontmatter,
  validateSkillFrontmatter,
  hasErrors,
  hasWarnings,
} from '../validate-frontmatter.js';

let tmpDir: string;

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeTmp(): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'claudiao-validate-'));
  return tmpDir;
}

function writeAgent(dir: string, name: string, frontmatter: string, body = '\n\nbody'): string {
  const filePath = join(dir, `${name}.md`);
  writeFileSync(filePath, `---\n${frontmatter}\n---${body}`);
  return filePath;
}

describe('validateAgentFrontmatter', () => {
  it('returns no issues for a complete valid agent', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'good',
      [
        'name: good-agent',
        'description: Agente de teste com descrição boa e gatilho explícito. Use when user asks for something specific.',
        'tools: Read, Write, Edit',
        'model: opus',
      ].join('\n'),
    );

    const result = validateAgentFrontmatter(file);

    expect(result.issues).toEqual([]);
    expect(hasErrors(result)).toBe(false);
    expect(hasWarnings(result)).toBe(false);
  });

  it('reports error when name is missing', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'noname',
      [
        'description: descrição longa o suficiente com gatilho use when necessário para atingir o minimo',
        'tools: Read',
        'model: opus',
      ].join('\n'),
    );

    const result = validateAgentFrontmatter(file);
    expect(hasErrors(result)).toBe(true);
    expect(result.issues.find((i) => i.field === 'name')?.severity).toBe('error');
  });

  it('reports error when description is missing', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'nodesc',
      ['name: nodesc', 'tools: Read', 'model: opus'].join('\n'),
    );

    const result = validateAgentFrontmatter(file);
    expect(hasErrors(result)).toBe(true);
    expect(result.issues.find((i) => i.field === 'description')?.severity).toBe('error');
  });

  it('warns when description is too short', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'short',
      [
        'name: short',
        'description: short desc',
        'tools: Read',
        'model: opus',
      ].join('\n'),
    );

    const result = validateAgentFrontmatter(file);
    expect(hasWarnings(result)).toBe(true);
    expect(result.issues.some((i) => i.field === 'description' && i.severity === 'warn')).toBe(true);
  });

  it('warns when description has no explicit trigger', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'notrigger',
      [
        'name: notrigger',
        'description: Esse agente faz muitas coisas interessantes e úteis no dia a dia do desenvolvedor sênior',
        'tools: Read',
        'model: opus',
      ].join('\n'),
    );

    const result = validateAgentFrontmatter(file);
    expect(
      result.issues.some(
        (i) => i.field === 'description' && i.message.includes('gatilho'),
      ),
    ).toBe(true);
  });

  it('reports error when tools is not a string', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'badtools',
      [
        'name: badtools',
        'description: descrição boa com gatilho use when, suficientemente longa pra passar no minimo de chars',
        'tools:',
        '  - Read',
        '  - Write',
        'model: opus',
      ].join('\n'),
    );

    const result = validateAgentFrontmatter(file);
    expect(hasErrors(result)).toBe(true);
    expect(result.issues.some((i) => i.field === 'tools' && i.severity === 'error')).toBe(true);
  });

  it('warns when model is missing', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'nomodel',
      [
        'name: nomodel',
        'description: descrição boa com gatilho use when, suficientemente longa pra passar no minimo de chars',
        'tools: Read',
      ].join('\n'),
    );

    const result = validateAgentFrontmatter(file);
    expect(result.issues.some((i) => i.field === 'model' && i.severity === 'warn')).toBe(true);
  });
});

describe('validateSkillFrontmatter', () => {
  it('returns no issues for a complete valid skill', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'skill',
      [
        'name: my-skill',
        'description: Skill com descrição boa, suficientemente longa pra atingir o mínimo requerido',
        'allowed-tools: Read, Write',
        'model: sonnet',
      ].join('\n'),
    );

    const result = validateSkillFrontmatter(file);
    expect(result.issues).toEqual([]);
  });

  it('reports error when name is missing', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'skill',
      [
        'description: desc longa o suficiente pra passar no mínimo sem problemas nenhum agora',
        'allowed-tools: Read',
        'model: sonnet',
      ].join('\n'),
    );

    const result = validateSkillFrontmatter(file);
    expect(hasErrors(result)).toBe(true);
  });

  it('warns when allowed-tools is missing', () => {
    const dir = makeTmp();
    const file = writeAgent(
      dir,
      'skill',
      [
        'name: skill',
        'description: desc longa o suficiente pra passar no mínimo sem problemas nenhum agora',
        'model: sonnet',
      ].join('\n'),
    );

    const result = validateSkillFrontmatter(file);
    expect(
      result.issues.some((i) => i.field === 'allowed-tools' && i.severity === 'warn'),
    ).toBe(true);
  });
});
