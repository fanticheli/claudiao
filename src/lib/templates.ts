export interface AgentTemplateInput {
  name: string;
  description: string;
  title: string;
  intro: string;
  scope: string;
  tools: string[];
  model: string;
  category: string;
  whenToUse: string[];
  principles: string[];
  antiPatterns: string[];
}

export interface SkillTemplateInput {
  name: string;
  description: string;
  title: string;
  tools: string[];
  model: string;
  whenToActivate: string[];
  templateContent: string;
}

export function renderAgentTemplate(input: AgentTemplateInput): string {
  const toolsStr = input.tools.join(', ');
  const whenToUse = input.whenToUse.map(w => `- ${w}`).join('\n');
  const principles = input.principles.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const antiPatterns = input.antiPatterns.map(a => `- ${a}`).join('\n');

  return `---
name: ${input.name}
description: ${input.description}
tools: ${toolsStr}
model: ${input.model}
category: ${input.category}
---

# ${input.title}

${input.intro}

## Antes de comecar

- Leia \`CLAUDE.md\` do projeto se existir
- Mapeie a arquitetura atual com Glob/Grep
- Identifique padroes e convencoes ja em uso

## Escopo

${input.scope}

## Quando usar

${whenToUse}

## Ferramentas preferidas

- **Glob/Grep** para mapear arquitetura e padroes do projeto
- **Read** para analisar configs e modulos
- **Bash** para rodar comandos
- **Edit** para modificar codigo

## Principios

${principles}

## Anti-Patterns que sempre flagra

${antiPatterns}
`;
}

export function renderSkillTemplate(input: SkillTemplateInput): string {
  const toolsStr = input.tools.join(', ');
  const whenToActivate = input.whenToActivate.map(w => `- ${w}`).join('\n');

  return `---
name: ${input.name}
description: ${input.description}
allowed-tools: ${toolsStr}
model: ${input.model}
---

# ${input.title}

## Quando ativar

Ative quando o usuario estiver:
${whenToActivate}

## Template

${input.templateContent}
`;
}

export const DEFAULT_AGENT_TOOLS = [
  'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'WebFetch',
];

export const DEFAULT_SKILL_TOOLS = [
  'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash',
];
