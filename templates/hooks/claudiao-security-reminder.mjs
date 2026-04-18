#!/usr/bin/env node
// claudiao-managed hook — security reminder
// Triggers: lembra /security-checklist ao editar endpoints/auth/routes
// Cross-platform (Node.js). NÃO bloqueia. Só lembra.

import { readFileSync } from 'node:fs';

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== 'string' || filePath.length === 0) process.exit(0);

const pattern = /(controller|route|handler|endpoint|middleware|guard|\/api\/|\/auth\/|webhook)/i;
if (!pattern.test(filePath)) process.exit(0);

const message = `[claudiao] Arquivo parece ser endpoint/auth (${filePath}). Antes de declarar pronto, considere rodar /security-checklist pra validar: input validation, auth guard, rate limit, secrets, CORS. Isso é lembrete, não bloqueio.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message,
    },
  }),
);
