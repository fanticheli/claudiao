#!/usr/bin/env bash
# claudiao-managed hook — UI review reminder
# Triggers: lembra /ui-review-checklist ao editar componentes de frontend
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

# Match: tsx, jsx, vue, svelte, ou arquivos em components/pages/views
if printf '%s' "$file_path" | grep -qiE '\.(tsx|jsx|vue|svelte)$|/components?/|/pages?/|/views?/'; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "[claudiao] Componente de UI em edição ($file_path). Antes de abrir PR, considere /ui-review-checklist: hierarquia visual, acessibilidade (labels, focus, contraste), responsividade (320px+), estados (loading/empty/error), touch targets 44px."
  }
}
EOF
fi
