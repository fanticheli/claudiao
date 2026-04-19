import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, PACKAGE_ROOT } from '../lib/paths.js';
import { parseAgentFile, parseSkillFile } from '../lib/frontmatter.js';
import { getInstallSource } from '../lib/symlinks.js';
import { banner, heading, table, info, raw } from '../lib/format.js';
import { PLUGINS } from '../lib/plugins.js';

export function listAgents(): void {
  banner();
  heading('Agentes instalados');

  if (!existsSync(CLAUDE_AGENTS_DIR)) {
    info('Nenhum agente instalado. Rode `claudiao init` ou `claudiao create agent`.');
    return;
  }

  const files = readdirSync(CLAUDE_AGENTS_DIR).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    info('Nenhum agente instalado.');
    return;
  }

  const rows = files.map(file => {
    const filePath = join(CLAUDE_AGENTS_DIR, file);
    const source = getInstallSource(filePath, PACKAGE_ROOT);
    try {
      const meta = parseAgentFile(filePath);
      return {
        name: meta.name || file.replace('.md', ''),
        description: meta.description.slice(0, 70),
        category: meta.category || 'other',
        source,
        status: 'installed' as const,
      };
    } catch {
      return {
        name: file.replace('.md', ''),
        description: chalk.dim('(erro ao ler frontmatter)'),
        category: 'other',
        source,
        status: 'installed' as const,
      };
    }
  });

  // Dynamic grouping by category from frontmatter
  const CATEGORY_LABELS: Record<string, string> = {
    dev: 'Desenvolvimento',
    cloud: 'Cloud & Infra',
    quality: 'Qualidade & Seguranca',
    planning: 'Planejamento & Gestao',
  };

  const CATEGORY_ORDER = ['dev', 'cloud', 'quality', 'planning'];

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const cat = row.category;
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(row);
  }

  // Ordered categories first, then any others alphabetically
  const orderedKeys = [
    ...CATEGORY_ORDER.filter(k => grouped.has(k)),
    ...[...grouped.keys()].filter(k => !CATEGORY_ORDER.includes(k)).sort(),
  ];

  for (const key of orderedKeys) {
    const catRows = grouped.get(key);
    if (catRows && catRows.length > 0) {
      const label = CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
      raw(`  ${chalk.bold(label)}`);
      table(catRows);
      raw('');
    }
  }

  info(`${files.length} agentes instalados no total`);
  raw('');
}

export function listSkills(): void {
  banner();
  heading('Skills instaladas');

  if (!existsSync(CLAUDE_SKILLS_DIR)) {
    info('Nenhuma skill instalada. Rode `claudiao init` ou `claudiao create skill`.');
    return;
  }

  const dirs = readdirSync(CLAUDE_SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() || d.isSymbolicLink());

  if (dirs.length === 0) {
    info('Nenhuma skill instalada.');
    return;
  }

  const rows = dirs.map(d => {
    const skillDir = join(CLAUDE_SKILLS_DIR, d.name);
    const skillFile = join(skillDir, 'SKILL.md');
    const source = getInstallSource(skillDir, PACKAGE_ROOT);
    try {
      if (existsSync(skillFile)) {
        const meta = parseSkillFile(skillFile);
        return {
          name: '/' + (meta.name || d.name),
          description: meta.description.slice(0, 70),
          source,
        };
      }
    } catch {
      // fallthrough
    }
    return {
      name: '/' + d.name,
      description: '',
      source,
    };
  });

  table(rows);
  raw('');
  info(`${dirs.length} skills instaladas. Use digitando o comando no Claude Code.`);
  raw('');
}

export function listPlugins(): void {
  banner();
  heading('Plugins da comunidade');

  // Multi-part rendering: use raw() so quiet/json modes can suppress
  // everything at once without touching each line.
  raw(chalk.dim('  Ferramentas extras que complementam os agentes/skills.'));
  raw(chalk.dim('  Instale com: claudiao install plugin <nome>'));
  raw('');

  for (const plugin of PLUGINS) {
    raw(`  ${chalk.bold(plugin.name)} ${plugin.stars ? chalk.dim(`(${plugin.stars} stars)`) : ''}`);
    raw(`  ${chalk.dim(plugin.description)}`);
    raw(`  ${chalk.dim('Repo: ' + plugin.repo)}`);
    raw(`  ${chalk.dim('Instalar: ' + plugin.installCommand)}`);
    raw('');
  }
}
