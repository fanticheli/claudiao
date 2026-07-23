#!/usr/bin/env node
// claudiao-managed hook — no-comments enforcer
// Triggers: bloqueia Write/Edit que introduz comentários em código-fonte.
// Cross-platform (Node.js). BLOQUEIA (permissionDecision: deny).

import { readFileSync } from 'node:fs';

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const toolName = payload?.tool_name ?? '';
const input = payload?.tool_input;
if (!input || typeof input !== 'object') process.exit(0);

const filePath = input.file_path;
if (typeof filePath !== 'string' || filePath.length === 0) process.exit(0);

const ext = (filePath.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();

const C_STYLE = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs',
  'go', 'rs', 'java', 'kt', 'kts', 'c', 'cc', 'cpp', 'cxx',
  'h', 'hh', 'hpp', 'cs', 'swift', 'scala', 'php', 'dart', 'm', 'mm',
]);
const HASH_STYLE = new Set(['py', 'rb', 'sh', 'bash', 'zsh']);

const style = C_STYLE.has(ext) ? 'c' : HASH_STYLE.has(ext) ? 'hash' : null;
if (!style) process.exit(0);

function commentReason(line) {
  const t = line.trim();
  if (t.length === 0) return null;

  if (style === 'c') {
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*/') || t.startsWith('* ') || t === '*') {
      return t;
    }
    if (/\S\s+\/\/(?!\/)(?<!:\/\/)/.test(line) && !/:\/\//.test(line.replace(/\/\/.*$/, ''))) {
      return t;
    }
    return null;
  }

  if (t.startsWith('#') && !t.startsWith('#!')) return t;
  if (/\S\s+#\s/.test(line)) return t;
  return null;
}

function addedLines(oldText, newText) {
  const seen = new Set(String(oldText ?? '').split('\n').map((l) => l.trim()));
  return String(newText ?? '')
    .split('\n')
    .filter((l) => !seen.has(l.trim()));
}

let baseline = '';
if (toolName === 'Write') {
  try {
    baseline = readFileSync(filePath, 'utf-8');
  } catch {
    baseline = '';
  }
}

const candidates = [];
if (toolName === 'Write') {
  candidates.push(...addedLines(baseline, input.content));
} else if (toolName === 'Edit') {
  candidates.push(...addedLines(input.old_string, input.new_string));
} else if (toolName === 'MultiEdit' && Array.isArray(input.edits)) {
  for (const edit of input.edits) {
    candidates.push(...addedLines(edit?.old_string, edit?.new_string));
  }
} else {
  candidates.push(...addedLines('', input.content ?? input.new_string));
}

const offenders = [];
for (const line of candidates) {
  const reason = commentReason(line);
  if (reason) offenders.push(reason);
}

if (offenders.length === 0) process.exit(0);

const sample = offenders.slice(0, 3).map((l) => `  ${l.length > 80 ? l.slice(0, 77) + '...' : l}`).join('\n');
const reason = `[claudiao] Bloqueado: esta edição adiciona comentário(s) no código (${filePath}). Regra do usuário: NÃO adicione comentários — escreva código autoexplicativo (nomes claros, funções pequenas). Linhas detectadas:\n${sample}\n\nReescreva sem os comentários e tente de novo. Exceção só se o usuário pediu explicitamente, ou for TODO/FIXME solicitado, ou explicar um "porquê" não óbvio.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }),
);
