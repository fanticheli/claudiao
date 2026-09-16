#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const C_STYLE = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs',
  'go', 'rs', 'java', 'kt', 'kts', 'c', 'cc', 'cpp', 'cxx',
  'h', 'hh', 'hpp', 'cs', 'swift', 'scala', 'php', 'dart', 'm', 'mm',
  'css', 'scss', 'less', 'prisma', 'proto', 'graphql', 'gql',
]);
const MARKUP_STYLE = new Set(['vue', 'svelte', 'html', 'htm']);
const HASH_STYLE = new Set(['py', 'rb', 'sh', 'bash', 'zsh', 'tf', 'hcl']);
const SQL_STYLE = new Set(['sql']);
const TRIPLE_QUOTES = ['"""', "'''"];

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

export function multilineStringLines(text, style) {
  const source = String(text ?? '');
  const triples = style === 'hash' ? TRIPLE_QUOTES : [];
  const inside = new Set();
  let line = 0;
  let open = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '\n') {
      line += 1;
      if (open?.singleLine) open = null;
      if (open) inside.add(line);
      continue;
    }
    if (open) {
      if (source.startsWith(open.delimiter, index)) {
        index += open.delimiter.length - 1;
        open = null;
      }
      continue;
    }
    const triple = triples.find((candidate) => source.startsWith(candidate, index));
    if (triple) {
      open = { delimiter: triple, singleLine: false };
      index += triple.length - 1;
      continue;
    }
    if (char === '`' && style !== 'hash') {
      open = { delimiter: '`', singleLine: false };
      continue;
    }
    if (char === '"' || char === "'") {
      open = { delimiter: char, singleLine: true };
    }
  }
  return inside;
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

export function isComment(line, style) {
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

export function offendingLines(text, baseline, style) {
  const insideStrings = multilineStringLines(text, style);
  const existing = new Set(String(baseline ?? '').split('\n').map((line) => line.trim()));
  return String(text ?? '')
    .split('\n')
    .filter((line, index) => !insideStrings.has(index) && !existing.has(line.trim()) && isComment(line, style));
}

function fileBaseline(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function offenders(toolName, input, style) {
  if (toolName === 'Write') return offendingLines(input.content, fileBaseline(input.file_path), style);
  if (toolName === 'Edit') return offendingLines(input.new_string, input.old_string, style);
  if (Array.isArray(input.edits)) {
    return input.edits.flatMap((edit) => offendingLines(edit?.new_string, edit?.old_string, style));
  }
  return offendingLines(input.content ?? input.new_string, '', style);
}

function main() {
  const payload = readPayload();
  const input = payload?.tool_input;
  const filePath = input?.file_path;
  if (typeof filePath !== 'string' || !filePath) return;

  const style = styleFor(filePath);
  if (!style) return;

  const detected = offenders(payload.tool_name ?? '', input, style);
  if (detected.length === 0) return;

  const sample = detected
    .slice(0, 5)
    .map((line) => {
      const trimmed = line.trim();
      return `  ${trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed}`;
    })
    .join('\n');

  const reason = [
    `[standards] BLOQUEADO: a edição adiciona comentário em ${filePath}.`,
    'Regra global (~/.claude/rules/code-standards.md): ZERO comentários no código, em qualquer projeto, mesmo que o CLAUDE.md do repo permita.',
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
}

function invokedDirectly() {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
