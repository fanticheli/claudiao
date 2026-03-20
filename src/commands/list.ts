import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR } from '../lib/paths.js';
import { parseAgentFile, parseSkillFile } from '../lib/frontmatter.js';
import { isSymlink } from '../lib/symlinks.js';
import { banner, heading, table, info } from '../lib/format.js';
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
    try {
      const meta = parseAgentFile(filePath);
      return {
        name: meta.name || file.replace('.md', ''),
        description: meta.description.slice(0, 70),
        category: meta.category || 'other',
        status: 'installed' as const,
      };
    } catch {
      return {
        name: file.replace('.md', ''),
        description: chalk.dim('(erro ao ler frontmatter)'),
        category: 'other',
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
      console.log(`  ${chalk.bold(label)}`);
      table(catRows);
      console.log('');
    }
  }

  info(`${files.length} agentes instalados no total`);
  console.log('');
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
    const skillFile = join(CLAUDE_SKILLS_DIR, d.name, 'SKILL.md');
    try {
      if (existsSync(skillFile)) {
        const meta = parseSkillFile(skillFile);
        return {
          name: '/' + (meta.name || d.name),
          description: meta.description.slice(0, 70),
        };
      }
    } catch {
      // fallthrough
    }
    return {
      name: '/' + d.name,
      description: '',
    };
  });

  table(rows);
  console.log('');
  info(`${dirs.length} skills instaladas. Use digitando o comando no Claude Code.`);
  console.log('');
}

export function listPlugins(): void {
  banner();
  heading('Plugins da comunidade');

  console.log(chalk.dim('  Ferramentas extras que complementam os agentes/skills.'));
  console.log(chalk.dim('  Instale com: claudiao install plugin <nome>'));
  console.log('');

  for (const plugin of PLUGINS) {
    console.log(`  ${chalk.bold(plugin.name)} ${plugin.stars ? chalk.dim(`(${plugin.stars} stars)`) : ''}`);
    console.log(`  ${chalk.dim(plugin.description)}`);
    console.log(`  ${chalk.dim('Repo: ' + plugin.repo)}`);
    console.log(`  ${chalk.dim('Instalar: ' + plugin.installCommand)}`);
    console.log('');
  }
}
