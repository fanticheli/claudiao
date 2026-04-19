import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, getAgentsSavePath } from '../lib/paths.js';
import { removeSymlink, isSymlink } from '../lib/symlinks.js';
import { banner, success, error, heading, warn, info, dim, raw } from '../lib/format.js';
import { dryRunnable } from '../lib/dry-run.js';

export async function removeAgent(name: string, options?: { dryRun?: boolean }): Promise<void> {
  const dryRun = options?.dryRun ?? false;
  banner();
  heading(`Remover agente: ${name}`);

  if (dryRun) {
    info('[dry-run] Nenhuma alteracao sera feita');
    raw('');
  }

  const symlinkPath = join(CLAUDE_AGENTS_DIR, `${name}.md`);

  if (!existsSync(symlinkPath)) {
    error(`Agente "${name}" nao encontrado em ~/.claude/agents/`);
    dim('Rode `claudiao list agents` pra ver os disponiveis.');
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Remover agente "${name}"?`,
    default: false,
  }]);

  if (!confirm) {
    raw(chalk.dim('  Cancelado.'));
    return;
  }

  const isLink = isSymlink(symlinkPath);
  const dryRemoveMsg = isLink
    ? `Removeria symlink: ~/.claude/agents/${name}.md`
    : `Removeria arquivo: ~/.claude/agents/${name}.md`;

  dryRunnable({ dryRun }, () => {
    const removed = removeSymlink(symlinkPath);
    if (removed) {
      success(`Symlink removido: ~/.claude/agents/${name}.md`);
    } else {
      rmSync(symlinkPath);
      success(`Arquivo removido: ~/.claude/agents/${name}.md`);
    }
  }, dryRemoveMsg);

  // Ask if should also remove source
  const savePath = getAgentsSavePath();
  if (savePath) {
    const sourcePath = join(savePath, `${name}.md`);
    if (existsSync(sourcePath)) {
      if (dryRun) {
        info(`[dry-run] Perguntaria se quer remover fonte: ${sourcePath}`);
      } else {
        const { removeSource } = await inquirer.prompt([{
          type: 'confirm',
          name: 'removeSource',
          message: 'Remover tambem o arquivo fonte do repositorio?',
          default: false,
        }]);

        if (removeSource) {
          rmSync(sourcePath);
          success(`Fonte removido: ${sourcePath}`);
        }
      }
    }
  }

  raw('');
}

export async function removeSkill(name: string, options?: { dryRun?: boolean }): Promise<void> {
  const dryRun = options?.dryRun ?? false;
  banner();
  heading(`Remover skill: ${name}`);

  if (dryRun) {
    info('[dry-run] Nenhuma alteracao sera feita');
    raw('');
  }

  const symlinkPath = join(CLAUDE_SKILLS_DIR, name);

  if (!existsSync(symlinkPath)) {
    error(`Skill "${name}" nao encontrada em ~/.claude/skills/`);
    dim('Rode `claudiao list skills` pra ver as disponiveis.');
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Remover skill "/${name}"?`,
    default: false,
  }]);

  if (!confirm) {
    raw(chalk.dim('  Cancelado.'));
    return;
  }

  const isLink = isSymlink(symlinkPath);
  const dryRemoveMsg = isLink
    ? `Removeria symlink: ~/.claude/skills/${name}`
    : `Removeria diretorio: ~/.claude/skills/${name}`;

  dryRunnable({ dryRun }, () => {
    const removed = removeSymlink(symlinkPath);
    if (removed) {
      success(`Symlink removido: ~/.claude/skills/${name}`);
    } else {
      rmSync(symlinkPath, { recursive: true });
      success(`Diretorio removido: ~/.claude/skills/${name}`);
    }
  }, dryRemoveMsg);

  raw('');
}
