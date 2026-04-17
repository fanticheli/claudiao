#!/usr/bin/env bash
# claudiao-managed hook — conventional commits reminder
# Triggers: ao rodar `git commit`, valida se mensagem segue conventional commits
#
# NÃO bloqueia. Só lembra.

set -euo pipefail

payload=$(cat)

# Extrai command da tool Bash
command=$(printf '%s' "$payload" \
  | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed -E 's/.*"([^"]*)"$/\1/')

if [[ -z "${command:-}" ]]; then
  exit 0
fi

# Só age em git commit -m "..."
if ! printf '%s' "$command" | grep -qE 'git commit.*-m'; then
  exit 0
fi

# Extrai mensagem entre aspas (simplificado — pega a primeira)
msg=$(printf '%s' "$command" | grep -oE '\-m[[:space:]]+"[^"]*"' | head -1 | sed -E 's/^-m[[:space:]]+"(.*)"$/\1/')

if [[ -z "${msg:-}" ]]; then
  exit 0
fi

# Conventional commit: type(scope): description — ou type: description
if ! printf '%s' "$msg" | grep -qE '^(feat|fix|chore|refactor|docs|test|ci|perf|style|build|revert)(\([^)]+\))?!?:[[:space:]]+.+$'; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "[claudiao] Commit message não parece conventional. Esperado: 'type(scope): description' em inglês, imperativo, lowercase. Exemplos: 'feat(auth): add OAuth2 login', 'fix(orders): resolve race condition'."
  }
}
EOF
fi
