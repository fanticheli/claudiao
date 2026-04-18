#!/usr/bin/env node
// claudiao-managed hook — migration reminder
// Triggers: lembra /sql-templates ao criar migrations
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

const pattern = /(migrations?\/|\.sql$|alembic\/versions|prisma\/migrations|db\/migrate)/i;
if (!pattern.test(filePath)) process.exit(0);

const message = `[claudiao] Migration detectada (${filePath}). Checklist rápido: CREATE INDEX CONCURRENTLY? ALTER ... NOT NULL via CHECK NOT VALID + VALIDATE em tabelas grandes? Backfill em batches com SKIP LOCKED? Veja /sql-templates para patterns zero-downtime.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message,
    },
  }),
);
