import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  CLAUDE_DIR, CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, CLAUDE_MD, CONFIG_FILE,
  getAgentsSource, getSkillsSource, getGlobalMdSource, getExternalRepoPath,
} from '../lib/paths.js';
import { createSymlink, ensureDir } from '../lib/symlinks.js';
import { parseAgentFile } from '../lib/frontmatter.js';
import { banner, success, warn, error, info, dim, heading, separator } from '../lib/format.js';
import { PLUGINS } from '../lib/plugins.js';
import { execSync } from 'node:child_process';

export async function init(options?: { dryRun?: boolean }): Promise<void> {
  const dryRun = options?.dryRun ?? false;
  banner();

  if (dryRun) {
    info('[dry-run] Nenhuma alteracao sera feita');
    console.log('');
  }

  // Check prerequisites
  heading('Verificando pre-requisitos...');

  const hasNode = process.version;
  success(`Node.js ${hasNode}`);

  if (!dryRun) {
    try {
      execSync('which claude', { stdio: 'pipe' });
      success('Claude Code encontrado');
    } catch {
      warn('Claude Code nao encontrado no PATH');
      dim('Instale com: npm install -g @anthropic-ai/claude-code');
    }
  } else {
    info('[dry-run] Verificaria se Claude Code esta no PATH');
  }

  // Resolve sources
  const agentsSource = getAgentsSource();
  const skillsSource = getSkillsSource();
  const globalMdSource = getGlobalMdSource();

  // Create ~/.claude/
  if (!dryRun) {
    ensureDir(CLAUDE_DIR);
  } else {
    info('[dry-run] Criaria diretorio ~/.claude/ (se nao existir)');
  }

  // [1/3] Install CLAUDE.md global
  heading('[1/3] CLAUDE.md Global');
  dim('Regras universais de codigo, git workflow, lista de agentes/skills');
  console.log('');

  if (globalMdSource) {
    if (dryRun) {
      info(`[dry-run] Linkaria ${globalMdSource} -> ~/.claude/CLAUDE.md`);
    } else {
      const result = createSymlink(globalMdSource, CLAUDE_MD);
      if (result.status === 'created' || result.status === 'backup') {
        success('~/.claude/CLAUDE.md instalado');
      } else if (result.status === 'skipped') {
        info('CLAUDE.md ja estava instalado');
      }
    }
  } else {
    warn('global-CLAUDE.md nao encontrado');
  }

  // [2/3] Install agents
  heading('[2/3] Agentes');
  dim('Especialistas que o Claude Code invoca automaticamente pelo contexto');
  console.log('');

  let agentCount = 0;
  if (agentsSource && existsSync(agentsSource)) {
    if (!dryRun) {
      ensureDir(CLAUDE_AGENTS_DIR);
    }
    const agentFiles = readdirSync(agentsSource).filter(f => f.endsWith('.md'));
    agentCount = agentFiles.length;

    if (dryRun) {
      for (const file of agentFiles) {
        const source = join(agentsSource, file);
        try {
          const meta = parseAgentFile(source);
          info(`[dry-run] Linkaria agente: ${meta.name} ${chalk.dim('— ' + meta.description.slice(0, 60))}`);
        } catch {
          info(`[dry-run] Linkaria agente: ${file.replace('.md', '')}`);
        }
      }
      console.log('');
      info(`[dry-run] ${agentCount} agentes seriam processados`);
    } else {
      let installed = 0;
      let skipped = 0;

      for (const file of agentFiles) {
        const source = join(agentsSource, file);
        const target = join(CLAUDE_AGENTS_DIR, file);

        try {
          const meta = parseAgentFile(source);
          const result = createSymlink(source, target);

          if (result.status === 'created' || result.status === 'backup') {
            success(`${meta.name} ${chalk.dim('— ' + meta.description.slice(0, 60))}`);
            installed++;
          } else {
            console.log(`  ${chalk.yellow('⏭')} ${meta.name} ${chalk.dim('— ja instalado')}`);
            skipped++;
          }
        } catch {
          const result = createSymlink(source, target);
          if (result.status !== 'skipped') installed++;
          else skipped++;
        }
      }

      console.log('');
      info(`${chalk.green(String(installed) + ' novos')} | ${chalk.dim(String(skipped) + ' ja existiam')}`);
    }
  } else {
    warn('Nenhum agente encontrado. Use `claudiao create agent` pra criar.');
  }

  // [3/3] Install skills
  heading('[3/3] Skills');
  dim('Slash commands com templates prontos (ex: /pr-template, /security-checklist)');
  console.log('');

  let skillCount = 0;
  if (skillsSource && existsSync(skillsSource)) {
    if (!dryRun) {
      ensureDir(CLAUDE_SKILLS_DIR);
    }
    const skillDirs = readdirSync(skillsSource, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    skillCount = skillDirs.length;

    if (dryRun) {
      for (const dir of skillDirs) {
        info(`[dry-run] Linkaria skill: /${dir}`);
      }
      console.log('');
      info(`[dry-run] ${skillCount} skills seriam processadas`);
    } else {
      let installed = 0;
      let skipped = 0;

      for (const dir of skillDirs) {
        const source = join(skillsSource, dir);
        const target = join(CLAUDE_SKILLS_DIR, dir);
        const result = createSymlink(source, target);

        if (result.status === 'created' || result.status === 'backup') {
          success(`/${dir}`);
          installed++;
        } else {
          console.log(`  ${chalk.yellow('⏭')} /${dir} ${chalk.dim('— ja instalada')}`);
          skipped++;
        }
      }

      console.log('');
      info(`${chalk.green(String(installed) + ' novas')} | ${chalk.dim(String(skipped) + ' ja existiam')}`);
    }
  } else {
    warn('Nenhuma skill encontrada. Use `claudiao create skill` pra criar.');
  }

  // Ask about plugins
  if (dryRun) {
    console.log('');
    info('[dry-run] Pulando prompts de plugins');
    info('[dry-run] Plugins disponiveis: superpowers, get-shit-done, claude-mem');
  } else {
    console.log('');
    const { installPlugins } = await inquirer.prompt([{
      type: 'confirm',
      name: 'installPlugins',
      message: 'Quer instalar plugins da comunidade? (superpowers, get-shit-done, claude-mem)',
      default: false,
    }]);

    if (installPlugins) {
      heading('Plugins da Comunidade');

      for (const plugin of PLUGINS) {
        console.log('');
        console.log(`  ${chalk.bold(plugin.name)} ${plugin.stars ? chalk.dim(`(${plugin.stars} stars)`) : ''}`);
        dim(plugin.description);
        dim(`Repo: ${plugin.repo}`);
        console.log('');

        const { install } = await inquirer.prompt([{
          type: 'confirm',
          name: 'install',
          message: `  Instalar ${plugin.name}?`,
          default: false,
        }]);

        if (install) {
          try {
            execSync(plugin.installCommand, { stdio: 'inherit' });
            success(`${plugin.name} instalado`);
          } catch {
            error(`Falha ao instalar ${plugin.name}. Tente manualmente: ${plugin.installCommand}`);
          }
        }
      }
    }
  }

  // Save config — preserve existing repoPath if current source is unavailable
  if (dryRun) {
    info('[dry-run] Salvaria configuracao em .claudiao.json');
  } else {
    let existingConfig: Record<string, unknown> = {};
    if (existsSync(CONFIG_FILE)) {
      try {
        existingConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      } catch {
        // ignore corrupt config
      }
    }

    const config = {
      repoPath: getExternalRepoPath() || existingConfig.repoPath || undefined,
      installedAt: new Date().toISOString(),
      version: existingConfig.version || '1.0.0',
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  // Summary
  separator();
  console.log(chalk.green.bold('  Pronto! claudiao configurado.'));
  separator();

  console.log(chalk.bold('  O que foi instalado:'));
  if (globalMdSource) console.log(`  ${chalk.green('✓')} CLAUDE.md global com regras e configuracoes`);
  if (agentCount > 0) console.log(`  ${chalk.green('✓')} ${agentCount} agentes especializados`);
  if (skillCount > 0) console.log(`  ${chalk.green('✓')} ${skillCount} skills / slash commands`);
  console.log('');

  console.log(chalk.bold('  Proximos passos:'));
  console.log(`  ${chalk.cyan('1.')} Abra o terminal e rode ${chalk.yellow('claude')} em qualquer projeto`);
  console.log(`  ${chalk.cyan('2.')} Os agentes sao ativados automaticamente pelo contexto`);
  console.log(`  ${chalk.cyan('3.')} Use skills digitando o comando (ex: ${chalk.yellow('/security-checklist')})`);
  console.log('');
  console.log(chalk.bold('  Comandos uteis:'));
  console.log(`  ${chalk.yellow('claudiao list agents')}     Lista todos os agentes instalados`);
  console.log(`  ${chalk.yellow('claudiao list skills')}     Lista todas as skills`);
  console.log(`  ${chalk.yellow('claudiao create agent')}    Cria um novo agente`);
  console.log(`  ${chalk.yellow('claudiao doctor')}          Verifica se tudo esta ok`);
  console.log('');
}
