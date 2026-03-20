import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseAgentFile, parseSkillFile, serializeAgent, serializeSkill } from '../frontmatter.js';
import type { AgentMeta, SkillMeta } from '../../types.js';

let tmpDir: string;

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeTmp(): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'claudiao-fm-'));
  return tmpDir;
}

describe('parseAgentFile', () => {
  it('should parse all frontmatter fields from an agent file', () => {
    const dir = makeTmp();
    const file = join(dir, 'test-agent.md');
    writeFileSync(file, `---
name: architect
description: Decisoes de arquitetura
tools: Read, Grep, Bash
model: opus
category: development
---

You are an architecture specialist.
`);

    const result = parseAgentFile(file);

    expect(result.name).toBe('architect');
    expect(result.description).toBe('Decisoes de arquitetura');
    expect(result.tools).toEqual(['Read', 'Grep', 'Bash']);
    expect(result.model).toBe('opus');
    expect(result.category).toBe('development');
    expect(result.content).toContain('architecture specialist');
  });

  it('should use defaults when frontmatter fields are missing', () => {
    const dir = makeTmp();
    const file = join(dir, 'minimal.md');
    writeFileSync(file, `---
name: minimal
---

Body content.
`);

    const result = parseAgentFile(file);

    expect(result.name).toBe('minimal');
    expect(result.description).toBe('');
    expect(result.tools).toEqual(['']);
    expect(result.model).toBe('opus');
    expect(result.category).toBe('other');
  });
});

describe('parseSkillFile', () => {
  it('should parse all frontmatter fields from a skill file', () => {
    const dir = makeTmp();
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, `---
name: security-checklist
description: Checklist pre-deploy
allowed-tools: Read, Grep
model: sonnet
---

# Security Checklist
`);

    const result = parseSkillFile(file);

    expect(result.name).toBe('security-checklist');
    expect(result.description).toBe('Checklist pre-deploy');
    expect(result.allowedTools).toEqual(['Read', 'Grep']);
    expect(result.model).toBe('sonnet');
    expect(result.content).toContain('Security Checklist');
  });

  it('should use defaults when frontmatter fields are missing', () => {
    const dir = makeTmp();
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, `---
name: basic
---

Content.
`);

    const result = parseSkillFile(file);

    expect(result.name).toBe('basic');
    expect(result.description).toBe('');
    expect(result.allowedTools).toEqual(['']);
    expect(result.model).toBe('sonnet');
  });
});

describe('serializeAgent', () => {
  it('should produce valid markdown with frontmatter', () => {
    const meta: AgentMeta = {
      name: 'test-agent',
      description: 'A test agent',
      tools: ['Read', 'Write', 'Bash'],
      model: 'opus',
      category: 'testing',
    };

    const output = serializeAgent(meta, '\nYou are a test agent.\n');

    expect(output).toContain('name: test-agent');
    expect(output).toContain('description: A test agent');
    // gray-matter quotes values containing commas
    expect(output).toContain("tools: 'Read, Write, Bash'");
    expect(output).toContain('model: opus');
    expect(output).toContain('category: testing');
    expect(output).toContain('You are a test agent.');
  });

  it('should omit category when not provided', () => {
    const meta: AgentMeta = {
      name: 'no-cat',
      description: 'No category',
      tools: ['Read'],
      model: 'opus',
    };

    const output = serializeAgent(meta, '\nBody.\n');

    // "category" appears inside "description: No category" but should not appear as its own key
    expect(output).not.toMatch(/^category:/m);
  });
});

describe('serializeSkill', () => {
  it('should produce valid markdown with frontmatter', () => {
    const meta: SkillMeta = {
      name: 'my-skill',
      description: 'A skill',
      allowedTools: ['Grep', 'Read'],
      model: 'sonnet',
    };

    const output = serializeSkill(meta, '\nSkill body.\n');

    expect(output).toContain('name: my-skill');
    expect(output).toContain('description: A skill');
    // gray-matter quotes values containing commas
    expect(output).toContain("allowed-tools: 'Grep, Read'");
    expect(output).toContain('model: sonnet');
    expect(output).toContain('Skill body.');
  });
});

describe('round-trip', () => {
  it('should serialize then parse an agent and get the same data back', () => {
    const dir = makeTmp();
    const meta: AgentMeta = {
      name: 'round-trip-agent',
      description: 'Round trip test',
      tools: ['Read', 'Bash'],
      model: 'opus',
      category: 'testing',
    };
    const body = '\nAgent instructions here.\n';

    const serialized = serializeAgent(meta, body);
    const file = join(dir, 'agent.md');
    writeFileSync(file, serialized);

    const parsed = parseAgentFile(file);

    expect(parsed.name).toBe(meta.name);
    expect(parsed.description).toBe(meta.description);
    expect(parsed.tools).toEqual(meta.tools);
    expect(parsed.model).toBe(meta.model);
    expect(parsed.category).toBe(meta.category);
    expect(parsed.content).toContain('Agent instructions here.');
  });

  it('should serialize then parse a skill and get the same data back', () => {
    const dir = makeTmp();
    const meta: SkillMeta = {
      name: 'round-trip-skill',
      description: 'Round trip skill test',
      allowedTools: ['Grep', 'Write'],
      model: 'haiku',
    };
    const body = '\nSkill instructions here.\n';

    const serialized = serializeSkill(meta, body);
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, serialized);

    const parsed = parseSkillFile(file);

    expect(parsed.name).toBe(meta.name);
    expect(parsed.description).toBe(meta.description);
    expect(parsed.allowedTools).toEqual(meta.allowedTools);
    expect(parsed.model).toBe(meta.model);
    expect(parsed.content).toContain('Skill instructions here.');
  });
});
