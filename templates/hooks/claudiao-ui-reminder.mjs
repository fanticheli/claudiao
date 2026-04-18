#!/usr/bin/env node
// claudiao-managed hook — UI review reminder
// Triggers: lembra /ui-review-checklist ao editar componentes de frontend
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

const pattern = /\.(tsx|jsx|vue|svelte)$|\/components?\/|\/pages?\/|\/views?\//i;
if (!pattern.test(filePath)) process.exit(0);

const message = `[claudiao] Componente de UI em edição (${filePath}). Antes de abrir PR, considere /ui-review-checklist: hierarquia visual, acessibilidade (labels, focus, contraste), responsividade (320px+), estados (loading/empty/error), touch targets 44px.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message,
    },
  }),
);
