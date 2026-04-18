#!/usr/bin/env node
// claudiao-managed hook — conventional commits reminder
// Triggers: valida formato da mensagem ao rodar `git commit -m ...`
// Cross-platform (Node.js). NÃO bloqueia. Só lembra.

import { readFileSync } from 'node:fs';

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command;
if (typeof command !== 'string' || command.length === 0) process.exit(0);

if (!/\bgit\s+commit\b/.test(command) || !/-m\b/.test(command)) process.exit(0);

// Extract first -m "..." or -m '...' payload. Handles both quote styles and
// preserves embedded escaped quotes inside the message.
const match =
  command.match(/-m\s+"((?:[^"\\]|\\.)*)"/) ??
  command.match(/-m\s+'((?:[^'\\]|\\.)*)'/);
if (!match) process.exit(0);

const msg = match[1];
if (!msg) process.exit(0);

const conventional = /^(feat|fix|chore|refactor|docs|test|ci|perf|style|build|revert)(\([^)]+\))?!?:\s+.+$/;
if (conventional.test(msg)) process.exit(0);

const message = `[claudiao] Commit message não parece conventional. Esperado: 'type(scope): description' em inglês, imperativo, lowercase. Exemplos: 'feat(auth): add OAuth2 login', 'fix(orders): resolve race condition'.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message,
    },
  }),
);
