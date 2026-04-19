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
import { getPackageVersion } from '../lib/package-info.js';
import {
  validateAgentFrontmatter,
  validateSkillFrontmatter,
  hasErrors,
  hasWarnings,
} from '../lib/validate-frontmatter.js';
import { banner, success, warn, error, info, dim, heading, separator, raw, debug } from '../lib/format.js';
import { dryRunnable } from '../lib/dry-run.js';
import { PLUGINS } from '../lib/plugins.js';
import { execSync } from 'node:child_process';

export async function init(options?: { dryRun?: boolean }): Promise<void> {
  const dryRun = options?.dryRun ?? false;
  let invalidCount = 0;
  banner();

  if (dryRun) {
    info('[dry-run] Nenhuma alteracao sera feita');
    raw('');
  }

  // Check prerequisites
  heading('Verificando pre-requisitos...');

  const hasNode = process.version;
  success(`Node.js ${hasNode}`);

  if (!dryRun) {
    try {
      execSync('which claude', { stdio: 'pipe' });
      success('Claude Code encontrado');
    } catch (err) {
      // expected: Claude Code is a peer install; we warn and keep going
      warn('Claude Code nao encontrado no PATH');
      dim('Instale com: npm install -g @anthropic-ai/claude-code');
      debug(`which claude failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    info('[dry-run] Verificaria se Claude Code esta no PATH');
  }

  // Resolve sources
  const agentsSource = getAgentsSource();
  const skillsSource = getSkillsSource();
  const globalMdSource = getGlobalMdSource();

  // Create ~/.claude/
  dryRunnable({ dryRun }, () => ensureDir(CLAUDE_DIR), 'Criaria diretorio ~/.claude/ (se nao existir)');

  // [1/3] Install CLAUDE.md global
  heading('[1/3] CLAUDE.md Global');
  dim('Regras universais de codigo, git workflow, lista de agentes/skills');
  raw('');

  if (globalMdSource) {
    dryRunnable({ dryRun }, () => {
      const result = createSymlink(globalMdSource, CLAUDE_MD);
      if (result.status === 'created' || result.status === 'backup') {
        success('~/.claude/CLAUDE.md instalado');
      } else if (result.status === 'skipped') {
        info('CLAUDE.md ja estava instalado');
      }
    }, `Linkaria ${globalMdSource} -> ~/.claude/CLAUDE.md`);
  } else {
    warn('global-CLAUDE.md nao encontrado');
  }

  // [2/3] Install agents
  heading('[2/3] Agentes');
  dim('Especialistas que o Claude Code invoca automaticamente pelo contexto');
  raw('');

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
        } catch (err) {
          // expected: agent file may have malformed frontmatter in dry-run preview;
          // fall back to filename so the preview still lists every file.
          info(`[dry-run] Linkaria agente: ${file.replace('.md', '')}`);
          debug(`parseAgentFile(${file}) failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      raw('');
      info(`[dry-run] ${agentCount} agentes seriam processados`);
    } else {
      let installed = 0;
      let skipped = 0;
      let invalid = 0;

      for (const file of agentFiles) {
        const source = join(agentsSource, file);
        const target = join(CLAUDE_AGENTS_DIR, file);

        const validation = validateAgentFrontmatter(source);
        if (hasErrors(validation)) {
          const errs = validation.issues.filter((i) => i.severity === 'error');
          error(`${file}: ${errs.map((i) => i.message).join('; ')}`);
          invalid++;
          invalidCount++;
          continue;
        }

        try {
          const meta = parseAgentFile(source);
          const result = createSymlink(source, target);

          if (result.status === 'created' || result.status === 'backup') {
            if (hasWarnings(validation)) {
              const warns = validation.issues.filter((i) => i.severity === 'warn');
              warn(`${meta.name} instalado com avisos: ${warns.map((i) => i.message).join('; ')}`);
            } else {
              success(`${meta.name} ${chalk.dim('— ' + meta.description.slice(0, 60))}`);
            }
            installed++;
          } else {
            raw(`  ${chalk.yellow('⏭')} ${meta.name} ${chalk.dim('— ja instalado')}`);
            skipped++;
          }
        } catch (err) {
          // expected: parseAgentFile can fail on legit-but-weird frontmatter
          // (validation already covers the disqualifying cases). Install
          // anyway and count the outcome so the tally stays honest.
          debug(`parseAgentFile(${file}) failed mid-install: ${err instanceof Error ? err.message : String(err)}`);
          const result = createSymlink(source, target);
          if (result.status !== 'skipped') installed++;
          else skipped++;
        }
      }

      raw('');
      const parts = [
        `${chalk.green(String(installed) + ' novos')}`,
        `${chalk.dim(String(skipped) + ' ja existiam')}`,
      ];
      if (invalid > 0) parts.push(chalk.red(`${invalid} ignorados (frontmatter invalido)`));
      info(parts.join(' | '));
    }
  } else {
    warn('Nenhum agente encontrado. Use `claudiao create agent` pra criar.');
  }

  // [3/3] Install skills
  heading('[3/3] Skills');
  dim('Slash commands com templates prontos (ex: /pr-template, /security-checklist)');
  raw('');

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
      raw('');
      info(`[dry-run] ${skillCount} skills seriam processadas`);
    } else {
      let installed = 0;
      let skipped = 0;
      let invalid = 0;

      for (const dir of skillDirs) {
        const source = join(skillsSource, dir);
        const target = join(CLAUDE_SKILLS_DIR, dir);
        const skillMd = join(source, 'SKILL.md');

        if (existsSync(skillMd)) {
          const validation = validateSkillFrontmatter(skillMd);
          if (hasErrors(validation)) {
            const errs = validation.issues.filter((i) => i.severity === 'error');
            error(`/${dir}: ${errs.map((i) => i.message).join('; ')}`);
            invalid++;
            invalidCount++;
            continue;
          }
          if (hasWarnings(validation)) {
            const warns = validation.issues.filter((i) => i.severity === 'warn');
            warn(`/${dir} com avisos: ${warns.map((i) => i.message).join('; ')}`);
          }
        }

        const result = createSymlink(source, target);
        if (result.status === 'created' || result.status === 'backup') {
          success(`/${dir}`);
          installed++;
        } else {
          raw(`  ${chalk.yellow('⏭')} /${dir} ${chalk.dim('— ja instalada')}`);
          skipped++;
        }
      }

      raw('');
      const parts = [
        `${chalk.green(String(installed) + ' novas')}`,
        `${chalk.dim(String(skipped) + ' ja existiam')}`,
      ];
      if (invalid > 0) parts.push(chalk.red(`${invalid} ignoradas (frontmatter invalido)`));
      info(parts.join(' | '));
    }
  } else {
    warn('Nenhuma skill encontrada. Use `claudiao create skill` pra criar.');
  }

  // Ask about plugins
  if (dryRun) {
    raw('');
    info('[dry-run] Pulando prompts de plugins');
    info('[dry-run] Plugins disponiveis: superpowers, get-shit-done, claude-mem');
  } else {
    raw('');
    const { installPlugins } = await inquirer.prompt([{
      type: 'confirm',
      name: 'installPlugins',
      message: 'Quer instalar plugins da comunidade? (superpowers, get-shit-done, claude-mem)',
      default: false,
    }]);

    if (installPlugins) {
      heading('Plugins da Comunidade');

      for (const plugin of PLUGINS) {
        raw('');
        raw(`  ${chalk.bold(plugin.name)} ${plugin.stars ? chalk.dim(`(${plugin.stars} stars)`) : ''}`);
        dim(plugin.description);
        dim(`Repo: ${plugin.repo}`);
        raw('');

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
          } catch (err) {
            error(`Falha ao instalar ${plugin.name}. Tente manualmente: ${plugin.installCommand}`);
            debug(`${plugin.installCommand} failed: ${err instanceof Error ? err.message : String(err)}`);
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
      } catch (err) {
        // expected: .claudiao.json can be hand-edited to invalid JSON; we
        // rewrite it fresh below, preserving only the default repoPath.
        debug(`ignored corrupt ${CONFIG_FILE}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const config = {
      repoPath: getExternalRepoPath() || existingConfig.repoPath || undefined,
      installedAt: new Date().toISOString(),
      version: getPackageVersion(),
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  // Summary — all composite formatted lines routed through raw() so quiet
  // mode can hush the block at once.
  separator();
  raw(chalk.green.bold('  Pronto! claudiao configurado.'));
  separator();

  raw(chalk.bold('  O que foi instalado:'));
  if (globalMdSource) raw(`  ${chalk.green('✓')} CLAUDE.md global com regras e configuracoes`);
  if (agentCount > 0) raw(`  ${chalk.green('✓')} ${agentCount} agentes especializados`);
  if (skillCount > 0) raw(`  ${chalk.green('✓')} ${skillCount} skills / slash commands`);
  raw('');

  raw(chalk.bold('  Proximos passos:'));
  raw(`  ${chalk.cyan('1.')} Abra o terminal e rode ${chalk.yellow('claude')} em qualquer projeto`);
  raw(`  ${chalk.cyan('2.')} Os agentes sao ativados automaticamente pelo contexto`);
  raw(`  ${chalk.cyan('3.')} Use skills digitando o comando (ex: ${chalk.yellow('/security-checklist')})`);
  raw('');
  raw(chalk.bold('  Comandos uteis:'));
  raw(`  ${chalk.yellow('claudiao list agents')}     Lista todos os agentes instalados`);
  raw(`  ${chalk.yellow('claudiao list skills')}     Lista todas as skills`);
  raw(`  ${chalk.yellow('claudiao create agent')}    Cria um novo agente`);
  raw(`  ${chalk.yellow('claudiao doctor')}          Verifica se tudo esta ok`);
  raw('');

  if (invalidCount > 0) {
    warn(`${invalidCount} item(s) nao foram instalados por frontmatter invalido. Rode ${chalk.yellow('claudiao doctor')} pra detalhes.`);
    process.exitCode = 1;
  }
}
