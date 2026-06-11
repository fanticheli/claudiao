import matter from 'gray-matter';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { AgentMeta, SkillMeta, CommandMeta } from '../types.js';

/**
 * Claude Code accepts tool lists both as CSV string ("Read, Write") and as
 * YAML array (- Read). Normalizes either shape; mirrors what
 * validate-frontmatter accepts so parse never throws on a valid file.
 */
function toToolList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((t) => String(t).trim());
  }
  return String(value ?? '').split(',').map((t) => t.trim());
}

export function parseAgentFile(filePath: string): AgentMeta & { content: string } {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    name: data.name || '',
    description: data.description || '',
    tools: toToolList(data.tools),
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
    allowedTools: toToolList(data['allowed-tools']),
    model: data.model || 'sonnet',
    content,
  };
}

export function parseCommandFile(filePath: string): CommandMeta & { content: string } {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  // Slash commands don't require `name:` — Claude Code derives the command
  // from the filename, so we do the same.
  const nameFromFile = basename(filePath, '.md');

  return {
    name: data.name || nameFromFile,
    description: data.description || '',
    argumentHint: data['argument-hint'] || undefined,
    allowedTools: toToolList(data['allowed-tools']).filter(Boolean),
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
