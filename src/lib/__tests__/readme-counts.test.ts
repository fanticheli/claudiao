import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../paths.js';

const templates = join(PACKAGE_ROOT, 'templates');
const readme = readFileSync(join(PACKAGE_ROOT, 'README.md'), 'utf-8');

const bundledCounts = {
  agents: readdirSync(join(templates, 'agents')).filter((file) => file.endsWith('.md')).length,
  skills: readdirSync(join(templates, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length,
  hooks: readdirSync(join(templates, 'hooks')).filter((file) => /^claudiao-.+\.mjs$/.test(file)).length,
};

const readmePatterns = {
  agents: /(\d+) agent(?:e)?s\b/g,
  skills: /(\d+) skills\b/g,
  hooks: /(\d+) hooks\b/g,
};

describe('README counts', () => {
  for (const [kind, pattern] of Object.entries(readmePatterns)) {
    it(`every ${kind} count matches the bundled templates`, () => {
      const counts = [...readme.matchAll(pattern)].map((match) => Number(match[1]));
      expect(counts.length).toBeGreaterThan(0);
      expect(new Set(counts)).toEqual(new Set([bundledCounts[kind as keyof typeof bundledCounts]]));
    });
  }
});
