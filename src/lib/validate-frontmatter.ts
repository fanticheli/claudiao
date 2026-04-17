import { readFileSync } from 'node:fs';
import matter from 'gray-matter';

export type Severity = 'error' | 'warn';

export interface FrontmatterIssue {
  field: string;
  severity: Severity;
  message: string;
}

export interface ValidationResult {
  file: string;
  name: string;
  issues: FrontmatterIssue[];
}

const TRIGGER_HINTS = [
  'when user says',
  'use when',
  'when the user',
  'trigger',
  'ative quando',
  'quando',
];

const MIN_DESCRIPTION_LENGTH = 50;

/**
 * Validates an agent's frontmatter. Returns list of issues — empty if all OK.
 */
export function validateAgentFrontmatter(filePath: string): ValidationResult {
  const raw = readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  const issues: FrontmatterIssue[] = [];
  const name = typeof data.name === 'string' ? data.name : '';

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    issues.push({ field: 'name', severity: 'error', message: 'campo `name` ausente ou vazio' });
  }

  if (!data.description || typeof data.description !== 'string') {
    issues.push({ field: 'description', severity: 'error', message: 'campo `description` ausente' });
  } else {
    if (data.description.length < MIN_DESCRIPTION_LENGTH) {
      issues.push({
        field: 'description',
        severity: 'warn',
        message: `description muito curta (${data.description.length} chars, mínimo ${MIN_DESCRIPTION_LENGTH})`,
      });
    }
    const lowered = data.description.toLowerCase();
    const hasTrigger = TRIGGER_HINTS.some((hint) => lowered.includes(hint));
    if (!hasTrigger) {
      issues.push({
        field: 'description',
        severity: 'warn',
        message: 'description sem gatilho explícito ("use when", "when user says", "ative quando")',
      });
    }
  }

  if (!data.tools) {
    issues.push({ field: 'tools', severity: 'warn', message: 'campo `tools` ausente (default: todas)' });
  } else if (typeof data.tools !== 'string') {
    issues.push({ field: 'tools', severity: 'error', message: 'campo `tools` deve ser string CSV' });
  }

  if (!data.model) {
    issues.push({ field: 'model', severity: 'warn', message: 'campo `model` ausente (default: opus)' });
  }

  return { file: filePath, name, issues };
}

/**
 * Validates a skill's frontmatter. Returns list of issues — empty if all OK.
 */
export function validateSkillFrontmatter(filePath: string): ValidationResult {
  const raw = readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  const issues: FrontmatterIssue[] = [];
  const name = typeof data.name === 'string' ? data.name : '';

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    issues.push({ field: 'name', severity: 'error', message: 'campo `name` ausente ou vazio' });
  }

  if (!data.description || typeof data.description !== 'string') {
    issues.push({ field: 'description', severity: 'error', message: 'campo `description` ausente' });
  } else if (data.description.length < MIN_DESCRIPTION_LENGTH) {
    issues.push({
      field: 'description',
      severity: 'warn',
      message: `description muito curta (${data.description.length} chars, mínimo ${MIN_DESCRIPTION_LENGTH})`,
    });
  }

  if (!data['allowed-tools']) {
    issues.push({
      field: 'allowed-tools',
      severity: 'warn',
      message: 'campo `allowed-tools` ausente (default: todas)',
    });
  }

  if (!data.model) {
    issues.push({ field: 'model', severity: 'warn', message: 'campo `model` ausente (default: sonnet)' });
  }

  return { file: filePath, name, issues };
}

export function hasErrors(result: ValidationResult): boolean {
  return result.issues.some((i) => i.severity === 'error');
}

export function hasWarnings(result: ValidationResult): boolean {
  return result.issues.some((i) => i.severity === 'warn');
}
