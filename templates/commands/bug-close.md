---
description: Após corrigir um bug, lê commits/diff, monta comentário com causa+solução e move card pra Done.
argument-hint: <KEY do card | vazio pra usar o último criado na sessão>
allowed-tools: Read, Bash, Grep, Glob, AskUserQuestion
---

Você vai fechar um bug no Jira complementando o card com a resolução, seguindo **fanti-flow**.

**Input do usuário**: $ARGUMENTS

## Passos

1. **Carregar config**: leia `~/.claude/skills/fanti-flow-config/SKILL.md`.

2. **Identificar issue key**:
   - Se $ARGUMENTS tem padrão `[A-Z]+-\d+`, use.
   - Senão, use a última key criada na sessão (se existir no contexto).
   - Senão, pergunte ao usuário.

3. **Ler o card atual** via `mcp__atlassian__getJiraIssue` pra saber título, status, descrição original e quem é assignee.

4. **Coletar evidências do código**:
   ```bash
   git log --author="$(git config user.email)" --since="3 days ago" --oneline -20
   git log --grep="<KEY>" --oneline -10
   git diff HEAD~3..HEAD --stat
   ```
   Identifique commits relacionados ao bug. Se ambíguo, mostre lista e pergunte quais entram.

5. **Coletar causa raiz e solução** via AskUserQuestion (perguntas curtas):
   - **Causa raiz**: 1-2 frases (o que estava errado)
   - **Solução aplicada**: 1-2 frases (como você corrigiu)
   - **Como validar**: passos pro QA/PM (1-3 itens)

6. **Descobrir transition correto**:
   - `mcp__atlassian__getTransitionsForJiraIssue` no card
   - Procurar transition cujo destino seja "Done" / "Concluído" / "Resolved" (varia por workflow)
   - Se múltiplos candidatos, pergunte qual usar

7. **Montar comentário** seguindo o **template "Bug close"** da skill. Idioma definido na skill (default: português).

8. **Preview**:
   ```
   ━━━ FECHAR BUG <KEY> ━━━
   Card: <título atual>
   Status atual: <...> → Status novo: <Done>

   Comentário a adicionar:
   <renderização do comentário>
   ━━━━━━━━━━━━━━━━━━━━━━━
   ```
   Pergunte: "Pode aplicar? (sim / ajustar / cancelar)"

9. **Se aprovado, em sequência**:
   - `mcp__atlassian__addCommentToJiraIssue`
   - `mcp__atlassian__transitionJiraIssue`
   - Reporte cada passo

10. **Slack opcional**: pergunte se comunica.
    - Mensagem default: ":white_check_mark: <KEY> resolvido — <título>. <link>"
    - Pergunte canal, preview, approval, envio.

## Não faça

- ❌ Mover pra Done sem confirmar nome do transition no workflow
- ❌ Atribuir commits que não são do usuário sem perguntar
- ❌ Postar no Slack se outra pessoa é assignee — alerte primeiro
- ❌ Pular a etapa de coletar causa raiz (é o que dá valor ao card pra equipe)
