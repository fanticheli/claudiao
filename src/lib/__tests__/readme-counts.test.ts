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
  agents: /(?:(\d+) agent(?:e)?s\b|Agentes incluídos \((\d+)\))/g,
  skills: /(?:(\d+) skills\b|Skills incluídas \((\d+)\))/g,
  hooks: /(\d+) hooks\b/g,
};

const bundledNames = {
  agents: readdirSync(join(templates, 'agents')).filter((file) => file.endsWith('.md')).map((file) => file.replace(/\.md$/, '')),
  skills: readdirSync(join(templates, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  commands: readdirSync(join(templates, 'commands')).filter((file) => file.endsWith('.md')).map((file) => file.replace(/\.md$/, '')),
};

describe('README lists every bundled template', () => {
  for (const [kind, names] of Object.entries(bundledNames)) {
    it(`mentions every bundled ${kind}`, () => {
      expect(names.filter((name) => !readme.includes(`\`${kind === 'agents' ? name : `/${name}`}\``))).toEqual([]);
    });
  }
});

describe('README counts', () => {
  for (const [kind, pattern] of Object.entries(readmePatterns)) {
    it(`every ${kind} count matches the bundled templates`, () => {
      const counts = [...readme.matchAll(pattern)].map((match) => Number(match[1] ?? match[2]));
      expect(counts.length).toBeGreaterThan(0);
      expect(new Set(counts)).toEqual(new Set([bundledCounts[kind as keyof typeof bundledCounts]]));
    });
  }
});
