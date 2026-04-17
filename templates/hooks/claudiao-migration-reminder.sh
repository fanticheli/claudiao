#!/usr/bin/env bash
# claudiao-managed hook — migration reminder
# Triggers: lembra /sql-templates ao criar migrations
#
# NÃO bloqueia. Só lembra.

set -euo pipefail

payload=$(cat)

file_path=$(printf '%s' "$payload" \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed -E 's/.*"([^"]*)"$/\1/')

if [[ -z "${file_path:-}" ]]; then
  exit 0
fi

# Match: migrations/*, *.sql, alembic/versions/, prisma/migrations/, db/migrate/ (rails)
if printf '%s' "$file_path" | grep -qiE '(migrations?/|\.sql$|alembic/versions|prisma/migrations|db/migrate)'; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "[claudiao] Migration detectada ($file_path). Checklist rápido: CREATE INDEX CONCURRENTLY? ALTER ... NOT NULL via CHECK NOT VALID + VALIDATE em tabelas grandes? Backfill em batches com SKIP LOCKED? Veja /sql-templates para patterns zero-downtime."
  }
}
EOF
fi
