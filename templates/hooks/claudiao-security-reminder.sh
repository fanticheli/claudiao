#!/usr/bin/env bash
# claudiao-managed hook — security reminder
# Triggers: lembra /security-checklist ao editar endpoints/auth/routes
#
# Payload chega via stdin como JSON da tool call (Write|Edit).
# Retorna JSON com additionalContext pro Claude considerar, ou nada (silêncio).
#
# NÃO bloqueia. Só lembra.

set -euo pipefail

payload=$(cat)

# Extrai file_path com grep (evita depender de jq)
file_path=$(printf '%s' "$payload" \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed -E 's/.*"([^"]*)"$/\1/')

if [[ -z "${file_path:-}" ]]; then
  exit 0
fi

# Match: controllers, routes, handlers, endpoints, auth, middleware, guards, /api/
if printf '%s' "$file_path" | grep -qiE '(controller|route|handler|endpoint|middleware|guard|/api/|/auth/|webhook)'; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "[claudiao] Arquivo parece ser endpoint/auth ($file_path). Antes de declarar pronto, considere rodar /security-checklist pra validar: input validation, auth guard, rate limit, secrets, CORS. Isso é lembrete, não bloqueio."
  }
}
EOF
fi
