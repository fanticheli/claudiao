import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import chalk from 'chalk';
import { getExternalRepoPath, getAgentsSource, getSkillsSource, getCommandsSource, CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, CLAUDE_COMMANDS_DIR } from '../lib/paths.js';
import { createSymlink, ensureDir, isSymlink, getSymlinkTarget } from '../lib/symlinks.js';
import { banner, success, warn, error, heading, info } from '../lib/format.js';

export function update(options?: { force?: boolean; dryRun?: boolean }): void {
  const force = options?.force ?? false;
  const dryRun = options?.dryRun ?? false;
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

      if (!existsSync(target)) {
        if (dryRun) {
          info(`[dry-run] Linkaria novo agente: ${file.replace('.md', '')}`);
        } else {
          createSymlink(source, target);
          success(`Novo agente: ${file.replace('.md', '')}`);
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

  // Re-link new slash commands
  const commandsSource = getCommandsSource();
  if (commandsSource && existsSync(commandsSource)) {
    heading(force ? 'Re-linkando todos os slash commands...' : 'Verificando novos slash commands...');
    ensureDir(CLAUDE_COMMANDS_DIR);

    const commandFiles = readdirSync(commandsSource).filter(f => f.endsWith('.md'));
    let newCommands = 0;
    let relinkedCommands = 0;

    for (const file of commandFiles) {
      const source = join(commandsSource, file);
      const target = join(CLAUDE_COMMANDS_DIR, file);

      if (!existsSync(target)) {
        if (dryRun) {
          info(`[dry-run] Linkaria novo command: /${file.replace('.md', '')}`);
        } else {
          createSymlink(source, target);
          success(`Novo command: /${file.replace('.md', '')}`);
        }
        newCommands++;
      } else if (force) {
        if (dryRun) {
          info(`[dry-run] Re-linkaria: /${file.replace('.md', '')}`);
        } else {
          createSymlink(source, target);
          info(`Re-linkado: /${file.replace('.md', '')}`);
        }
        relinkedCommands++;
      }
    }

    if (newCommands === 0 && relinkedCommands === 0) {
      info('Nenhum command novo');
    }
  }

  // Clean orphan symlinks
  heading('Verificando symlinks orfaos...');
  let orphans = 0;

  const dirsToScan = [CLAUDE_AGENTS_DIR, CLAUDE_COMMANDS_DIR];
  for (const dir of dirsToScan) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const filePath = join(dir, file);
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

  console.log('');
  success('Atualizacao concluida!');
  console.log('');
}
