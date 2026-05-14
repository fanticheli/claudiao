import matter from 'gray-matter';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { AgentMeta, SkillMeta, CommandMeta } from '../types.js';

export function parseAgentFile(filePath: string): AgentMeta & { content: string } {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    name: data.name || '',
    description: data.description || '',
    tools: (data.tools || '').split(',').map((t: string) => t.trim()),
    model: data.model || 'opus',
    category: data.category || 'other',
    content,
  };
}

export function parseSkillFile(filePath: string): SkillMeta & { content: string } {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    name: data.name || '',
    description: data.description || '',
    allowedTools: (data['allowed-tools'] || '').split(',').map((t: string) => t.trim()),
    model: data.model || 'sonnet',
    content,
  };
}

export function serializeAgent(meta: AgentMeta, content: string): string {
  const frontmatterData: Record<string, string> = {
    name: meta.name,
    description: meta.description,
    tools: meta.tools.join(', '),
    model: meta.model,
  };
  if (meta.category) {
    frontmatterData.category = meta.category;
  }
  return matter.stringify(content, frontmatterData);
}

export function serializeSkill(meta: SkillMeta, content: string): string {
  return matter.stringify(content, {
    name: meta.name,
    description: meta.description,
    'allowed-tools': meta.allowedTools.join(', '),
    model: meta.model,
  });
}

export function parseCommandFile(filePath: string): CommandMeta & { content: string } {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const nameFromFile = basename(filePath, '.md');

  return {
    name: data.name || nameFromFile,
    description: data.description || '',
    argumentHint: data['argument-hint'] || undefined,
    allowedTools: (data['allowed-tools'] || '').split(',').map((t: string) => t.trim()).filter(Boolean),
    content,
  };
}

export function serializeCommand(meta: CommandMeta, content: string): string {
  const frontmatterData: Record<string, string> = {
    description: meta.description,
  };
  if (meta.argumentHint) {
    frontmatterData['argument-hint'] = meta.argumentHint;
  }
  if (meta.allowedTools.length > 0) {
    frontmatterData['allowed-tools'] = meta.allowedTools.join(', ');
  }
  return matter.stringify(content, frontmatterData);
}
