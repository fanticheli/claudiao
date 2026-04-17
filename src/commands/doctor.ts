import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { CLAUDE_DIR, CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, CLAUDE_MD, CONFIG_FILE, getExternalRepoPath, getAgentsSource } from '../lib/paths.js';
import { isSymlink, getSymlinkTarget } from '../lib/symlinks.js';
import { banner, success, warn, error, heading } from '../lib/format.js';
import {
  validateAgentFrontmatter,
  validateSkillFrontmatter,
  hasErrors,
  hasWarnings,
} from '../lib/validate-frontmatter.js';

export function doctor(): void {
  banner();
  heading('Diagnostico do claudiao');

  let issues = 0;

  // 1. Claude Code
  try {
    execSync('which claude', { stdio: 'pipe' });
    success('Claude Code instalado');
  } catch {
    warn('Claude Code nao encontrado no PATH');
    console.log(chalk.dim('    Instale: npm install -g @anthropic-ai/claude-code'));
    issues++;
  }

  // 2. ~/.claude/ exists
  if (existsSync(CLAUDE_DIR)) {
    success('~/.claude/ existe');
  } else {
    error('~/.claude/ nao existe');
    console.log(chalk.dim('    Rode: claudiao init'));
    issues++;
  }

  // 3. CLAUDE.md global
  if (existsSync(CLAUDE_MD)) {
    if (isSymlink(CLAUDE_MD)) {
      const target = getSymlinkTarget(CLAUDE_MD);
      if (target && existsSync(target)) {
        success(`CLAUDE.md global OK ${chalk.dim('→ ' + target)}`);
      } else {
        error(`CLAUDE.md global: symlink quebrado → ${target}`);
        issues++;
      }
    } else {
      warn('CLAUDE.md global existe mas nao e symlink (nao sera atualizado automaticamente)');
    }
  } else {
    warn('CLAUDE.md global nao instalado');
    console.log(chalk.dim('    Rode: claudiao init'));
    issues++;
  }

  // 4. Agents
  if (existsSync(CLAUDE_AGENTS_DIR)) {
    const agents = readdirSync(CLAUDE_AGENTS_DIR).filter(f => f.endsWith('.md'));
    let broken = 0;

    for (const agent of agents) {
      const agentPath = join(CLAUDE_AGENTS_DIR, agent);
      if (isSymlink(agentPath)) {
        const target = getSymlinkTarget(agentPath);
        if (!target || !existsSync(target)) {
          error(`Agente ${agent}: symlink quebrado → ${target}`);
          broken++;
        }
      }
    }

    if (broken === 0) {
      success(`${agents.length} agentes instalados, todos OK`);
    } else {
      error(`${broken} agente(s) com symlink quebrado`);
      console.log(chalk.dim('    Rode: claudiao init (para reinstalar)'));
      issues += broken;
    }
  } else {
    warn('Nenhum agente instalado');
    issues++;
  }

  // 5. Skills
  if (existsSync(CLAUDE_SKILLS_DIR)) {
    const skills = readdirSync(CLAUDE_SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() || d.isSymbolicLink());
    let broken = 0;

    for (const skill of skills) {
      const skillPath = join(CLAUDE_SKILLS_DIR, skill.name);
      if (isSymlink(skillPath)) {
        const target = getSymlinkTarget(skillPath);
        if (!target || !existsSync(target)) {
          error(`Skill ${skill.name}: symlink quebrado → ${target}`);
          broken++;
        }
      }

      const skillMd = join(skillPath, 'SKILL.md');
      if (!existsSync(skillMd)) {
        warn(`Skill ${skill.name}: falta SKILL.md`);
      }
    }

    if (broken === 0) {
      success(`${skills.length} skills instaladas, todas OK`);
    } else {
      error(`${broken} skill(s) com symlink quebrado`);
      issues += broken;
    }
  } else {
    warn('Nenhuma skill instalada');
    issues++;
  }

  // 6. Config file
  if (existsSync(CONFIG_FILE)) {
    success('Config claudiao OK');
  } else {
    warn('Config claudiao nao encontrado (nao e obrigatorio)');
  }

  // 7. Repo path
  const repoPath = getExternalRepoPath();
  if (repoPath) {
    success(`Repo externo de agentes/skills: ${chalk.dim(repoPath)}`);
  }

  const agentsSource = getAgentsSource();
  if (agentsSource) {
    success(`Fonte de agentes: ${chalk.dim(agentsSource)}`);
  } else {
    warn('Nenhuma fonte de agentes encontrada');
  }

  const MAX_WARNINGS_SHOWN = 3;

  // 8. Frontmatter validation (agents)
  if (existsSync(CLAUDE_AGENTS_DIR)) {
    const agents = readdirSync(CLAUDE_AGENTS_DIR).filter((f) => f.endsWith('.md'));
    let errorCount = 0;
    let warnCount = 0;
    let warnsShown = 0;

    for (const agent of agents) {
      const agentPath = join(CLAUDE_AGENTS_DIR, agent);
      const realPath = isSymlink(agentPath) ? getSymlinkTarget(agentPath) : agentPath;
      if (!realPath || !existsSync(realPath)) continue;

      try {
        const result = validateAgentFrontmatter(realPath);
        if (hasErrors(result)) {
          errorCount++;
          const errs = result.issues.filter((i) => i.severity === 'error');
          error(`Agente ${result.name || agent}: ${errs.map((i) => i.message).join('; ')}`);
          issues++;
        } else if (hasWarnings(result)) {
          warnCount++;
          if (warnsShown < MAX_WARNINGS_SHOWN) {
            const warns = result.issues.filter((i) => i.severity === 'warn');
            warn(`Agente ${result.name}: ${warns.map((i) => i.message).join('; ')}`);
            warnsShown++;
          }
        }
      } catch (err) {
        error(`Agente ${agent}: falha ao parsear frontmatter (${err instanceof Error ? err.message : String(err)})`);
        issues++;
      }
    }

    if (errorCount === 0 && warnCount === 0) {
      success('Frontmatter de todos os agentes OK');
    } else if (errorCount === 0) {
      if (warnCount > MAX_WARNINGS_SHOWN) {
        console.log(chalk.dim(`    ... e mais ${warnCount - MAX_WARNINGS_SHOWN} agente(s) com avisos`));
      }
      warn(`${warnCount} agente(s) com avisos de frontmatter (não bloqueia, mas revise)`);
    }
  }

  // 9. Frontmatter validation (skills)
  if (existsSync(CLAUDE_SKILLS_DIR)) {
    const skills = readdirSync(CLAUDE_SKILLS_DIR, { withFileTypes: true }).filter(
      (d) => d.isDirectory() || d.isSymbolicLink(),
    );
    let errorCount = 0;
    let warnCount = 0;
    let warnsShown = 0;

    for (const skill of skills) {
      const skillMd = join(CLAUDE_SKILLS_DIR, skill.name, 'SKILL.md');
      if (!existsSync(skillMd)) continue;

      try {
        const result = validateSkillFrontmatter(skillMd);
        if (hasErrors(result)) {
          errorCount++;
          const errs = result.issues.filter((i) => i.severity === 'error');
          error(`Skill /${result.name || skill.name}: ${errs.map((i) => i.message).join('; ')}`);
          issues++;
        } else if (hasWarnings(result)) {
          warnCount++;
          if (warnsShown < MAX_WARNINGS_SHOWN) {
            const warns = result.issues.filter((i) => i.severity === 'warn');
            warn(`Skill /${result.name}: ${warns.map((i) => i.message).join('; ')}`);
            warnsShown++;
          }
        }
      } catch (err) {
        error(`Skill ${skill.name}: falha ao parsear frontmatter (${err instanceof Error ? err.message : String(err)})`);
        issues++;
      }
    }

    if (errorCount === 0 && warnCount === 0) {
      success('Frontmatter de todas as skills OK');
    } else if (errorCount === 0) {
      if (warnCount > MAX_WARNINGS_SHOWN) {
        console.log(chalk.dim(`    ... e mais ${warnCount - MAX_WARNINGS_SHOWN} skill(s) com avisos`));
      }
      warn(`${warnCount} skill(s) com avisos de frontmatter`);
    }
  }

  // Summary
  console.log('');
  if (issues === 0) {
    console.log(chalk.green.bold('  Tudo certo! Nenhum problema encontrado.'));
  } else {
    console.log(chalk.yellow.bold(`  ${issues} problema(s) encontrado(s). Veja as sugestoes acima.`));
  }
  console.log('');
}
