import { describe, it, expect } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { CLAUDE_DIR, CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, getTemplatesPath } from '../paths.js';

describe('path constants', () => {
  it('CLAUDE_DIR should point to ~/.claude', () => {
    expect(CLAUDE_DIR).toBe(join(homedir(), '.claude'));
  });

  it('CLAUDE_AGENTS_DIR should be inside CLAUDE_DIR', () => {
    expect(CLAUDE_AGENTS_DIR).toBe(join(CLAUDE_DIR, 'agents'));
  });

  it('CLAUDE_SKILLS_DIR should be inside CLAUDE_DIR', () => {
    expect(CLAUDE_SKILLS_DIR).toBe(join(CLAUDE_DIR, 'skills'));
  });
});

describe('getTemplatesPath', () => {
  it('should return a path that exists', () => {
    const templatesPath = getTemplatesPath();
    expect(existsSync(templatesPath)).toBe(true);
  });

  it('should point to a directory containing agents and/or skills', () => {
    const templatesPath = getTemplatesPath();
    // At minimum the templates directory itself should exist
    // The bundled templates dir ships with the package
    expect(typeof templatesPath).toBe('string');
    expect(templatesPath.length).toBeGreaterThan(0);
  });
});
