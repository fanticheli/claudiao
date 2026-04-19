#!/usr/bin/env node
// claudiao-managed hook — PR reminder (fecha o loop do fluxo)
// claudiao-hook-id: pr-reminder
// claudiao-hook-version: 1.0.0
// Triggers: lembra /pr-template e /security-checklist ao finalizar sessão com edits.
// Cross-platform (Node.js). NÃO bloqueia. Só lembra.

import { readFileSync } from 'node:fs';

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  // Stdin vazio/malformado: não quebra o fluxo do usuário.
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * Decide se a sessão teve trabalho de edição relevante.
 * Retorna true quando deve disparar o lembrete, false quando deve calar.
 *
 * Estratégia:
 *  1. Se payload expõe tool_use_count, respeita (0 = só-read, >0 = edits).
 *  2. Se payload expõe edit_count ou has_edits explícito, respeita.
 *  3. Se tem transcript_path legível, varre JSONL por tool_use de Edit/Write.
 *  4. Sem sinal nenhum: degrada para "lembrar" (falso positivo aceitável —
 *     lembrete extra é menos pior que silêncio em sessão longa).
 */
function shouldRemind(p) {
  if (p && typeof p === 'object') {
    if (typeof p.tool_use_count === 'number') return p.tool_use_count > 0;
    if (typeof p.edit_count === 'number') return p.edit_count > 0;
    if (typeof p.has_edits === 'boolean') return p.has_edits;

    if (typeof p.transcript_path === 'string' && p.transcript_path.length > 0) {
      try {
        const content = readFileSync(p.transcript_path, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.length === 0) continue;
          try {
            const entry = JSON.parse(line);
            const toolName =
              entry?.toolUseResult?.type === 'create' ? 'Write' :
              entry?.message?.content?.[0]?.name ??
              entry?.tool_use?.name ??
              entry?.name;
            if (typeof toolName === 'string' && EDIT_TOOLS.has(toolName)) {
              return true;
            }
          } catch {
            // Linha individual malformada não invalida o transcript inteiro.
          }
        }
        return false;
      } catch (err) {
        // Transcript inacessível: erra no lado de lembrar.
        process.stderr.write(
          `[claudiao pr-reminder] transcript unreadable (${err?.message ?? 'unknown'}), defaulting to remind\n`,
        );
        return true;
      }
    }
  }
  return true;
}

if (!shouldRemind(payload)) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const message = [
  '[claudiao] 🏁 Sessão finalizando com edits detectados. Antes de abrir PR, considere:',
  '  • /pr-template — gera descrição estruturada do PR',
  '  • /security-checklist — checklist OWASP pré-deploy (se mexeu em endpoints/auth)',
  '  • /ui-review-checklist — se mexeu em componentes visuais',
  '  • Conventional commits em inglês? Branch name segue padrão do projeto?',
].join('\n');

// Stop hooks não aceitam hookSpecificOutput no schema do Claude Code (esse
// campo é exclusivo de PreToolUse/UserPromptSubmit/PostToolUse). Pra lembrar
// o usuário sem bloquear, usamos systemMessage no top-level.
process.stdout.write(
  JSON.stringify({
    continue: true,
    systemMessage: message,
  }),
);
