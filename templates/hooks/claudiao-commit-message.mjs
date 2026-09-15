#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { portugueseProseEvidence } from './lib/portuguese.mjs';

const TYPES = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'ci', 'perf', 'style', 'build', 'revert'];
const CONVENTIONAL = new RegExp(`^(${TYPES.join('|')})(\\([\\w\\-./, ]+\\))?!?: \\S`);
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;
const GIT_COMMIT = /\bgit(?:\s+(?:-C|-c)\s+\S+)*\s+commit\b/;
const ATTRIBUTION = /co-authored-by:|generated with \[?claude|claude\.ai\/code|claude-session:|🤖/i;

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return null;
  }
}

function heredocBody(command) {
  const match = command.match(/<<-?\s*(['"]?)([A-Za-z_][\w]*)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2(?=\s|\)|$)/);
  return match ? match[3] : null;
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function inlineMessages(command) {
  const pattern = /(?:^|\s)(?:-[a-zA-Z]*m|--message)(?:\s+|=)("(?:\\.|[^"\\])*"|'[^']*'|\S+)/g;
  return [...command.matchAll(pattern)].map((match) => unquote(match[1]));
}

function fileMessage(command) {
  const match = command.match(/(?:^|\s)(?:-F|--file)(?:\s+|=)("[^"]+"|'[^']+'|\S+)/);
  if (!match) return null;
  const path = unquote(match[1]);
  if (path === '-') return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function extractMessage(command) {
  const commitIndex = command.search(GIT_COMMIT);
  const commitPart = command.slice(commitIndex);
  const heredoc = heredocBody(commitPart);
  if (heredoc !== null) return heredoc;
  const inline = inlineMessages(commitPart);
  if (inline.length > 0) return inline.join('\n\n');
  return fileMessage(commitPart);
}

const payload = readPayload();
if (payload?.tool_name !== 'Bash') process.exit(0);
const command = payload?.tool_input?.command;
if (typeof command !== 'string' || !GIT_COMMIT.test(command)) process.exit(0);

const message = extractMessage(command);
if (!message || !message.trim()) process.exit(0);

const subject = message.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
const problems = [];

if (!GIT_GENERATED.test(subject) && !CONVENTIONAL.test(subject)) {
  problems.push(`subject fora do padrão semântico: "${subject}" (esperado: type(scope): description, types: ${TYPES.join(', ')})`);
}

const evidence = portugueseProseEvidence(message);
if (evidence.length > 0) {
  problems.push(`mensagem em português: ${evidence.join('; ')}`);
}

if (ATTRIBUTION.test(message)) {
  problems.push('atribuição de IA na mensagem (Co-Authored-By / Generated with Claude / claude.ai/code / Claude-Session)');
}

if (problems.length === 0) process.exit(0);

const reason = [
  '[standards] BLOQUEADO: mensagem de commit fora da regra global do Igor (~/.claude/rules/code-standards.md).',
  ...problems.map((problem) => `  - ${problem}`),
  'Commit SEMPRE em inglês, semantic commit: type(scope): description. Ticket no fim, se houver: (CET-123). Sem atribuição. Não copie o idioma do git log do repo.',
  'Exemplo: fix(hired-candidate): make the hired candidate queue idempotent',
].join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
