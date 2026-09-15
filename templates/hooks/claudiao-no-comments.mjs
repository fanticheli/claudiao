#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const C_STYLE = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs',
  'go', 'rs', 'java', 'kt', 'kts', 'c', 'cc', 'cpp', 'cxx',
  'h', 'hh', 'hpp', 'cs', 'swift', 'scala', 'php', 'dart', 'm', 'mm',
  'css', 'scss', 'less', 'prisma', 'proto', 'graphql', 'gql',
]);
const MARKUP_STYLE = new Set(['vue', 'svelte', 'html', 'htm']);
const HASH_STYLE = new Set(['py', 'rb', 'sh', 'bash', 'zsh', 'tf', 'hcl']);
const SQL_STYLE = new Set(['sql']);

const DIRECTIVE_BODY = String.raw`(\/\/|#|--|\/\*|\{\/\*)\s*(eslint|@ts-|prettier-ignore|istanbul|c8 |v8 |biome-ignore|tslint|jshint|type:\s*ignore|noqa|pragma|pylint|mypy|pyright|ruff|isort|fmt:|sqlfluff|go:|\+build|nolint|webpack|@vite-ignore|@jsx|@refresh|#region|#endregion|region|endregion|-\*-)`;
const DIRECTIVE = new RegExp(`^${DIRECTIVE_BODY}`, 'i');
const INLINE_DIRECTIVE = new RegExp(`\\s${DIRECTIVE_BODY}.*$`, 'i');

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return null;
  }
}

function stripStrings(line) {
  return line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""');
}

function styleFor(filePath) {
  const ext = (filePath.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  if (C_STYLE.has(ext)) return 'c';
  if (MARKUP_STYLE.has(ext)) return 'markup';
  if (HASH_STYLE.has(ext)) return 'hash';
  if (SQL_STYLE.has(ext)) return 'sql';
  return null;
}

function isCStyleComment(trimmed, code) {
  if (/^(\/\/|\/\*|\*\/|\{\/\*)/.test(trimmed)) return true;
  if (/^\*(\s|$)/.test(trimmed) && !/[;{}()=]\s*$/.test(trimmed)) return true;
  if (/\S\s+\/\/(?!\/)/.test(code) && !/:\/\//.test(code)) return true;
  return /\/\*.*\*\//.test(code) || /\{\/\*/.test(code);
}

function isComment(line, style) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (DIRECTIVE.test(trimmed)) return false;
  const code = stripStrings(line).replace(INLINE_DIRECTIVE, '');

  if (style === 'c') return isCStyleComment(trimmed, code);
  if (style === 'markup') return /<!--/.test(code) || isCStyleComment(trimmed, code);
  if (style === 'hash') {
    if (trimmed.startsWith('#!')) return false;
    return trimmed.startsWith('#') || /\s#\s/.test(code);
  }
  if (style === 'sql') {
    return /^(--|\/\*|\{#)/.test(trimmed) || /\s--\s/.test(code) || /\{#.*#\}/.test(code);
  }
  return false;
}

function addedLines(oldText, newText) {
  const existing = new Set(String(oldText ?? '').split('\n').map((line) => line.trim()));
  return String(newText ?? '')
    .split('\n')
    .filter((line) => !existing.has(line.trim()));
}

function candidateLines(toolName, input) {
  if (toolName === 'Write') {
    let baseline = '';
    try {
      baseline = readFileSync(input.file_path, 'utf-8');
    } catch {
      baseline = '';
    }
    return addedLines(baseline, input.content);
  }
  if (toolName === 'Edit') return addedLines(input.old_string, input.new_string);
  if (Array.isArray(input.edits)) {
    return input.edits.flatMap((edit) => addedLines(edit?.old_string, edit?.new_string));
  }
  return addedLines('', input.content ?? input.new_string);
}

const payload = readPayload();
const input = payload?.tool_input;
const filePath = input?.file_path;
if (typeof filePath !== 'string' || !filePath) process.exit(0);

const style = styleFor(filePath);
if (!style) process.exit(0);

const offenders = candidateLines(payload.tool_name ?? '', input).filter((line) => isComment(line, style));
if (offenders.length === 0) process.exit(0);

const sample = offenders
  .slice(0, 5)
  .map((line) => {
    const trimmed = line.trim();
    return `  ${trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed}`;
  })
  .join('\n');

const reason = [
  `[standards] BLOQUEADO: a edição adiciona comentário em ${filePath}.`,
  'Regra global do Igor (~/.claude/rules/code-standards.md): ZERO comentários no código, em qualquer projeto, mesmo que o CLAUDE.md do repo permita.',
  'Reescreva sem comentários: nomes descritivos, funções pequenas. O contexto vai no corpo do PR ou na doc.',
  `Linhas detectadas:\n${sample}`,
].join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
