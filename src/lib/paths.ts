import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { debug } from './format.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Package root: from dist/lib/ or src/lib/ go up to project root
function findPackageRoot(): string {
  let dir = resolve(__dirname, '..', '..');
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = resolve(dir, '..');
  }
  return resolve(__dirname, '..', '..');
}

export const PACKAGE_ROOT = findPackageRoot();

export const CLAUDE_DIR = join(homedir(), '.claude');
export const CLAUDE_AGENTS_DIR = join(CLAUDE_DIR, 'agents');
export const CLAUDE_SKILLS_DIR = join(CLAUDE_DIR, 'skills');
export const CLAUDE_MD = join(CLAUDE_DIR, 'CLAUDE.md');
export const CONFIG_FILE = join(CLAUDE_DIR, '.claudiao.json');

/**
 * Returns the path to the templates/ directory that ships with the package.
 * Works both in dev (src/) and prod (dist/).
 */
export function getTemplatesPath(): string {
  const templatesDir = join(PACKAGE_ROOT, 'templates');
  if (existsSync(templatesDir)) return templatesDir;
  return join(process.cwd(), 'templates');
}

/**
 * Returns the external repo path if configured (for users who also have
 * a private repo of agents/skills linked via config).
 */
export function getExternalRepoPath(): string | null {
  if (existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      if (config.repoPath && existsSync(join(config.repoPath, 'agents'))) {
        debug(`getExternalRepoPath: resolved to ${config.repoPath}`);
        return config.repoPath;
      }
    } catch (err) {
      // expected: CONFIG_FILE may contain partial/corrupt JSON when
      // another tool rewrites it. Silent fall-through to bundled paths
      // is the intended UX — only surface the reason in verbose mode.
      debug(
        `getExternalRepoPath: ignored unreadable ${CONFIG_FILE} (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
    }
  }
  return null;
}

/**
 * Returns the best source for agents: external repo > bundled templates.
 */
export function getAgentsSource(): string | null {
  const external = getExternalRepoPath();
  if (external) {
    const agentsDir = join(external, 'agents');
    if (existsSync(agentsDir)) return agentsDir;
  }

  const bundled = join(getTemplatesPath(), 'agents');
  if (existsSync(bundled)) return bundled;

  return null;
}

/**
 * Returns the best source for skills: external repo > bundled templates.
 */
export function getSkillsSource(): string | null {
  const external = getExternalRepoPath();
  if (external) {
    const skillsDir = join(external, 'skills');
    if (existsSync(skillsDir)) return skillsDir;
  }

  const bundled = join(getTemplatesPath(), 'skills');
  if (existsSync(bundled)) return bundled;

  return null;
}

/**
 * Returns the global CLAUDE.md source file.
 */
export function getGlobalMdSource(): string | null {
  const external = getExternalRepoPath();
  if (external) {
    const md = join(external, 'global-CLAUDE.md');
    if (existsSync(md)) return md;
  }

  const bundled = join(getTemplatesPath(), 'global-CLAUDE.md');
  if (existsSync(bundled)) return bundled;

  return null;
}

/**
 * Returns the path where new agents/skills should be saved.
 * Prefers external repo if configured, otherwise saves to templates/.
 */
export function getAgentsSavePath(): string {
  const external = getExternalRepoPath();
  if (external) return join(external, 'agents');
  return join(getTemplatesPath(), 'agents');
}

export function getSkillsSavePath(): string {
  const external = getExternalRepoPath();
  if (external) return join(external, 'skills');
  return join(getTemplatesPath(), 'skills');
}
