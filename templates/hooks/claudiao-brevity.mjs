#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INJECTED_PROMPT = /^\s*<(task-notification|system-reminder|local-command|bash-input|bash-stdout|bash-stderr|command-name|command-message)/;

export const BREVITY_REMINDER = '[brevity] Abra com a conclusão em 1-2 frases, em linguagem simples. Só uma pergunta por resposta, sem menu de opções a/b/c: recomende um caminho. Nenhum ID, sigla ou nome interno (card, PR, lease, gate) sem dizer o que é. Detalhe só o necessário.';

export function decide(payload) {
  if (payload?.hook_event_name !== 'UserPromptSubmit') return null;
  const prompt = String(payload.prompt ?? '');
  if (prompt.trim() === '' || INJECTED_PROMPT.test(prompt)) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: BREVITY_REMINDER,
    },
  };
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return;
  }
  const output = decide(payload);
  if (output) process.stdout.write(JSON.stringify(output));
}

function invokedDirectly() {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
