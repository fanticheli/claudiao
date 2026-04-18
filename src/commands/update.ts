import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import chalk from 'chalk';
import { getExternalRepoPath, getAgentsSource, getSkillsSource, CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, CONFIG_FILE } from '../lib/paths.js';
import { createSymlink, ensureDir, isSymlink, getSymlinkTarget } from '../lib/symlinks.js';
import { getPackageVersion } from '../lib/package-info.js';
import {
  validateAgentFrontmatter,
  validateSkillFrontmatter,
  hasErrors,
  hasWarnings,
} from '../lib/validate-frontmatter.js';
import { banner, success, warn, error, heading, info } from '../lib/format.js';

export function update(options?: { force?: boolean; dryRun?: boolean }): void {
  const force = options?.force ?? false;
  const dryRun = options?.dryRun ?? false;
  let invalidCount = 0;
  banner();

  if (dryRun) {
    info('[dry-run] Nenhuma alteracao sera feita');
    console.log('');
  }

  const repoPath = getExternalRepoPath();

  // Git pull if external repo
  if (repoPath) {
    heading('Atualizando repositorio...');
    if (dryRun) {
      info(`[dry-run] Executaria git pull em ${repoPath}`);
    } else {
      try {
        const result = execSync('git pull', { cwd: repoPath, encoding: 'utf-8' });
        if (result.includes('Already up to date')) {
          info('Repositorio ja esta atualizado');
        } else {
          success('Git pull concluido');
          console.log(chalk.dim('    ' + result.trim()));
        }
      } catch {
        warn('Falha no git pull (pode ser um diretorio local sem remote)');
      }
    }
  }

  // Re-link new agents
  const agentsSource = getAgentsSource();
  if (agentsSource && existsSync(agentsSource)) {
    heading(force ? 'Re-linkando todos os agentes...' : 'Verificando novos agentes...');
    ensureDir(CLAUDE_AGENTS_DIR);

    const agentFiles = readdirSync(agentsSource).filter(f => f.endsWith('.md'));
    let newAgents = 0;
    let relinkedAgents = 0;

    for (const file of agentFiles) {
      const source = join(agentsSource, file);
      const target = join(CLAUDE_AGENTS_DIR, file);

      const validation = validateAgentFrontmatter(source);
      if (hasErrors(validation)) {
        const errs = validation.issues.filter((i) => i.severity === 'error');
        error(`${file}: frontmatter invalido (${errs.map((i) => i.message).join('; ')})`);
        invalidCount++;
        continue;
      }
      const warnings = hasWarnings(validation)
        ? validation.issues.filter((i) => i.severity === 'warn')
        : [];

      if (!existsSync(target)) {
        if (dryRun) {
          info(`[dry-run] Linkaria novo agente: ${file.replace('.md', '')}`);
        } else {
          createSymlink(source, target);
          if (warnings.length > 0) {
            warn(`Novo agente ${file.replace('.md', '')}: ${warnings.map((i) => i.message).join('; ')}`);
          } else {
            success(`Novo agente: ${file.replace('.md', '')}`);
          }
        }
        newAgents++;
      } else if (force) {
        if (dryRun) {
          info(`[dry-run] Re-linkaria: ${file.replace('.md', '')}`);
        } else {
          createSymlink(source, target);
          info(`Re-linkado: ${file.replace('.md', '')}`);
        }
        relinkedAgents++;
      }
    }

    if (newAgents === 0 && relinkedAgents === 0) {
      info('Nenhum agente novo');
    }
  }

  // Re-link new skills
  const skillsSource = getSkillsSource();
  if (skillsSource && existsSync(skillsSource)) {
    heading(force ? 'Re-linkando todas as skills...' : 'Verificando novas skills...');
    ensureDir(CLAUDE_SKILLS_DIR);

    const skillDirs = readdirSync(skillsSource, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    let newSkills = 0;
    let relinkedSkills = 0;

    for (const dir of skillDirs) {
      const source = join(skillsSource, dir);
      const target = join(CLAUDE_SKILLS_DIR, dir);
      const skillMd = join(source, 'SKILL.md');

      if (existsSync(skillMd)) {
        const validation = validateSkillFrontmatter(skillMd);
        if (hasErrors(validation)) {
          const errs = validation.issues.filter((i) => i.severity === 'error');
          error(`/${dir}: frontmatter invalido (${errs.map((i) => i.message).join('; ')})`);
          invalidCount++;
          continue;
        }
      }

      if (!existsSync(target)) {
        if (dryRun) {
          info(`[dry-run] Linkaria nova skill: /${dir}`);
        } else {
          createSymlink(source, target);
          success(`Nova skill: /${dir}`);
        }
        newSkills++;
      } else if (force) {
        if (dryRun) {
          info(`[dry-run] Re-linkaria: /${dir}`);
        } else {
          createSymlink(source, target);
          info(`Re-linkada: /${dir}`);
        }
        relinkedSkills++;
      }
    }

    if (newSkills === 0 && relinkedSkills === 0) {
      info('Nenhuma skill nova');
    }
  }

  // Clean orphan symlinks
  heading('Verificando symlinks orfaos...');
  let orphans = 0;

  if (existsSync(CLAUDE_AGENTS_DIR)) {
    for (const file of readdirSync(CLAUDE_AGENTS_DIR)) {
      const filePath = join(CLAUDE_AGENTS_DIR, file);
      if (isSymlink(filePath)) {
        const target = getSymlinkTarget(filePath);
        const resolvedTarget = target ? resolve(dirname(filePath), target) : null;
        if (resolvedTarget && !existsSync(resolvedTarget)) {
          if (dryRun) {
            warn(`[dry-run] Removeria symlink orfao: ${file}`);
          } else {
            rmSync(filePath);
            warn(`Symlink orfao removido: ${file}`);
          }
          orphans++;
        }
      }
    }
  }

  if (orphans === 0) {
    info('Nenhum symlink orfao');
  }

  // Sync version in config file (fixes BUG-001: version was hardcoded)
  if (!dryRun && existsSync(CONFIG_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Record<string, unknown>;
      const currentVersion = getPackageVersion();
      if (existing.version !== currentVersion) {
        existing.version = currentVersion;
        writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, 2));
      }
    } catch {
      // ignore corrupt config
    }
  } else if (dryRun) {
    info(`[dry-run] Sincronizaria version em .claudiao.json com ${getPackageVersion()}`);
  }

  console.log('');
  success('Atualizacao concluida!');
  if (invalidCount > 0) {
    warn(`${invalidCount} item(s) pulados por frontmatter invalido. Rode ${chalk.yellow('claudiao doctor')} pra detalhes.`);
    process.exitCode = 1;
  }
  console.log('');
}
