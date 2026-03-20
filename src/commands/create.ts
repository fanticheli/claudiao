import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import slugify from '@sindresorhus/slugify';
import { CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR, getAgentsSavePath, getSkillsSavePath } from '../lib/paths.js';
import { createSymlink, ensureDir } from '../lib/symlinks.js';
import { renderAgentTemplate, renderSkillTemplate, DEFAULT_AGENT_TOOLS, DEFAULT_SKILL_TOOLS } from '../lib/templates.js';
import { banner, success, error, heading, info } from '../lib/format.js';

export async function createAgent(description?: string): Promise<void> {
  banner();
  heading('Criar novo agente');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Descreva o agente (o que ele faz, em que e especialista):',
      default: description,
      when: !description,
      validate: (v: string) => v.length > 10 || 'Descreva com pelo menos 10 caracteres',
    },
    {
      type: 'input',
      name: 'name',
      message: 'Nome do agente (kebab-case):',
      default: (ans: Record<string, string>) => {
        const desc = description || ans.description || '';
        // Extract a reasonable name from description
        const words = desc.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 3 && !['que', 'para', 'como', 'com', 'uma', 'este', 'esse', 'especialista'].includes(w))
          .slice(0, 2);
        return slugify(words.join('-'), { lowercase: true }) || 'new-agent';
      },
      validate: (v: string) => /^[a-z][a-z0-9-]+$/.test(v) || 'Use kebab-case (ex: go-specialist)',
    },
    {
      type: 'input',
      name: 'title',
      message: 'Titulo do agente (ex: Go Specialist Agent):',
      default: (ans: Record<string, string>) => {
        return ans.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Agent';
      },
    },
    {
      type: 'input',
      name: 'intro',
      message: 'Frase de introducao (quem e o agente):',
      default: (ans: Record<string, string>) => {
        const desc = description || ans.description;
        return `Voce e um engenheiro senior especializado. ${desc}`;
      },
    },
    {
      type: 'input',
      name: 'scope',
      message: 'Escopo (o que o agente responde e o que NAO responde):',
      default: 'Responda APENAS sobre o dominio descrito acima. Para questoes fora do escopo, indique o agente apropriado.',
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Ferramentas disponiveis:',
      choices: [
        { name: 'Read', checked: true },
        { name: 'Write', checked: true },
        { name: 'Edit', checked: true },
        { name: 'Grep', checked: true },
        { name: 'Glob', checked: true },
        { name: 'Bash', checked: true },
        { name: 'WebFetch', checked: true },
      ],
    },
    {
      type: 'list',
      name: 'category',
      message: 'Categoria:',
      choices: [
        { name: 'Desenvolvimento', value: 'dev' },
        { name: 'Cloud & Infra', value: 'cloud' },
        { name: 'Qualidade & Seguranca', value: 'quality' },
        { name: 'Planejamento & Gestao', value: 'planning' },
        { name: 'Outro', value: 'other' },
      ],
      default: 'dev',
    },
    {
      type: 'list',
      name: 'model',
      message: 'Modelo:',
      choices: [
        { name: 'opus (melhor raciocinio — recomendado pra agentes)', value: 'opus' },
        { name: 'sonnet (mais rapido e barato)', value: 'sonnet' },
      ],
      default: 'opus',
    },
    {
      type: 'input',
      name: 'whenToUse',
      message: 'Quando usar (separe cenarios com ;):',
      default: 'Quando o usuario perguntar sobre o dominio deste agente',
      filter: (v: string) => v.split(';').map((s: string) => s.trim()).filter(Boolean),
    },
    {
      type: 'input',
      name: 'principles',
      message: 'Principios do agente (separe com ;):',
      default: 'Qualidade acima de velocidade; Respeitar padroes existentes do projeto; Sugerir testes pra toda mudanca',
      filter: (v: string) => v.split(';').map((s: string) => s.trim()).filter(Boolean),
    },
    {
      type: 'input',
      name: 'antiPatterns',
      message: 'Anti-patterns que sempre flagra (separe com ;):',
      default: 'Codigo sem testes; Secrets hardcoded; Error handling generico',
      filter: (v: string) => v.split(';').map((s: string) => s.trim()).filter(Boolean),
    },
  ]);

  const finalDesc = description || answers.description;
  const agentContent = renderAgentTemplate({
    name: answers.name,
    description: finalDesc,
    title: answers.title,
    intro: answers.intro,
    scope: answers.scope,
    tools: answers.tools.length > 0 ? answers.tools : DEFAULT_AGENT_TOOLS,
    model: answers.model,
    category: answers.category,
    whenToUse: answers.whenToUse,
    principles: answers.principles,
    antiPatterns: answers.antiPatterns,
  });

  // Save the file
  const savePath = getAgentsSavePath();
  ensureDir(savePath);
  const agentFilePath = join(savePath, `${answers.name}.md`);

  if (existsSync(agentFilePath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Agente ${answers.name} ja existe. Sobrescrever?`,
      default: false,
    }]);
    if (!overwrite) {
      error('Cancelado.');
      return;
    }
  }

  writeFileSync(agentFilePath, agentContent);
  success(`Agente salvo em ${chalk.dim(agentFilePath)}`);

  // Create symlink
  ensureDir(CLAUDE_AGENTS_DIR);
  const target = join(CLAUDE_AGENTS_DIR, `${answers.name}.md`);
  createSymlink(agentFilePath, target);
  success(`Symlink criado em ~/.claude/agents/${answers.name}.md`);

  console.log('');
  info(`Agente ${chalk.bold(answers.name)} pronto! Abra o Claude Code e ele sera invocado automaticamente.`);
  console.log('');
}

export async function createSkill(description?: string): Promise<void> {
  banner();
  heading('Criar nova skill');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Descreva a skill (o que ela faz, que template/checklist fornece):',
      default: description,
      when: !description,
      validate: (v: string) => v.length > 10 || 'Descreva com pelo menos 10 caracteres',
    },
    {
      type: 'input',
      name: 'name',
      message: 'Nome da skill (kebab-case, sera o slash command):',
      default: (ans: Record<string, string>) => {
        const desc = description || ans.description || '';
        const words = desc.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 3 && !['que', 'para', 'como', 'com', 'uma'].includes(w))
          .slice(0, 2);
        return slugify(words.join('-'), { lowercase: true }) || 'new-skill';
      },
      validate: (v: string) => /^[a-z][a-z0-9-]+$/.test(v) || 'Use kebab-case (ex: deploy-checklist)',
    },
    {
      type: 'input',
      name: 'title',
      message: 'Titulo da skill:',
      default: (ans: Record<string, string>) => {
        return ans.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      },
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Ferramentas disponiveis:',
      choices: [
        { name: 'Read', checked: true },
        { name: 'Write', checked: true },
        { name: 'Edit', checked: true },
        { name: 'Grep', checked: true },
        { name: 'Glob', checked: true },
        { name: 'Bash', checked: true },
      ],
    },
    {
      type: 'input',
      name: 'whenToActivate',
      message: 'Quando ativar (separe cenarios com ;):',
      default: 'Quando o usuario pedir o template; Quando precisar do checklist',
      filter: (v: string) => v.split(';').map((s: string) => s.trim()).filter(Boolean),
    },
    {
      type: 'editor',
      name: 'templateContent',
      message: 'Conteudo do template/checklist (abre editor):',
      default: '```markdown\n# Template\n\n- [ ] Item 1\n- [ ] Item 2\n- [ ] Item 3\n```',
    },
  ]);

  const finalDesc = description || answers.description;
  const skillContent = renderSkillTemplate({
    name: answers.name,
    description: finalDesc,
    title: answers.title,
    tools: answers.tools.length > 0 ? answers.tools : DEFAULT_SKILL_TOOLS,
    model: 'sonnet',
    whenToActivate: answers.whenToActivate,
    templateContent: answers.templateContent,
  });

  // Save the skill
  const savePath = getSkillsSavePath();
  const skillDir = join(savePath, answers.name);

  ensureDir(skillDir);
  const skillFilePath = join(skillDir, 'SKILL.md');

  if (existsSync(skillFilePath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Skill ${answers.name} ja existe. Sobrescrever?`,
      default: false,
    }]);
    if (!overwrite) {
      error('Cancelado.');
      return;
    }
  }

  writeFileSync(skillFilePath, skillContent);
  success(`Skill salva em ${chalk.dim(skillFilePath)}`);

  // Create symlink
  ensureDir(CLAUDE_SKILLS_DIR);
  const skillTarget = join(CLAUDE_SKILLS_DIR, answers.name);
  createSymlink(skillDir, skillTarget);
  success(`Symlink criado em ~/.claude/skills/${answers.name}`);

  console.log('');
  info(`Skill pronta! Use ${chalk.yellow('/' + answers.name)} no Claude Code.`);
  console.log('');
}
