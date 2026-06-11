---
description: Resumo de fim de dia — atualiza cards Jira mexidos hoje e posta status consolidado no Slack.
argument-hint: <opcional, contexto extra do dia>
allowed-tools: Read, Bash, Grep, Glob, AskUserQuestion
---

Você vai fechar o dia do usuário: atualizar cards Jira e postar status no Slack. Fluxo **fanti-flow**.

**Input do usuário (contexto extra)**: $ARGUMENTS

## Passos

1. **Carregar config**: leia `~/.claude/skills/fanti-flow-config/SKILL.md`.

2. **Descobrir atividade de hoje** — pra cada repo listado no mapa "Repo local → Project key" da skill, rode em paralelo:
   ```bash
   cd <repo> && git log --author="$(git config user.email)" \
     --since="midnight" --pretty="%h%x09%s%x09%D" 2>/dev/null
   ```
   Se o repo não existir ou não tiver commits do dia, ignore silenciosamente.

   Se a skill não tem nenhum repo mapeado, perguntar ao usuário quais repos checar (ou usar CWD se for um repo git).

3. **Extrair issue keys** dos commits (regex `[A-Z]+-\d+` no subject e branch).

4. **Para cada issue key encontrada**: leia o card via `mcp__atlassian__getJiraIssue` pra ter título, status, assignee.

5. **Perguntar o que mais entrou**:
   - "Fora desses cards, fez mais alguma coisa hoje? (reuniões, decisões, blockers, spikes sem commit)"
   - "Algum dos cards listados deve ir pra outro status? (ex: In Review, Done)"
   - "Há algum blocker pra reportar?"

6. **Montar updates**:

   **Comentário por card** (formato da skill, idioma definido lá):
   ```
   **Progresso (<data>)**
   <1-2 frases do que avançou hoje neste card>

   - Commits: <hashes>
   - Próximo passo: <...>
   - Blockers: <nenhum | descrição>
   ```

   **Mensagem Slack consolidada** (uma só, idioma da skill):
   ```
   :wave: *EOD <data>*

   *Em andamento*
   • <KEY> <título> — <linha>
   ...

   *Concluído hoje*
   • <KEY> <título>

   *Blockers*
   • <nenhum | descrição>
   ```

7. **Preview completo**:
   ```
   ━━━ EOD <data> ━━━

   COMENTÁRIOS NO JIRA (<N> cards):
   --- <KEY-1>: <título>
   <comentário>

   --- <KEY-2>: <título>
   <comentário>
   ...

   TRANSITIONS (se houver):
   <KEY-X>: <de> → <para>

   MENSAGEM SLACK:
   <render>
   ━━━━━━━━━━━━━━━━━━
   ```

   Pergunte: "Pode aplicar tudo? (sim / ajustar item X / cancelar)"

   Se o usuário pedir ajuste, refazer apenas a parte ajustada e re-perguntar.

8. **Se aprovado**:
   - Para cada card: `addCommentToJiraIssue` (e `transitionJiraIssue` se houver mudança de status)
   - Pergunte qual canal Slack (a menos que a skill defina canal default)
   - `slack_send_message` com a consolidada
   - Reporte sucessos um a um

9. **Persistir aprendizado**: se descobriu um canal Slack usado hoje, salve em memória pra sugerir como primeira opção no próximo EOD.

## Edge cases

- **Sem commits hoje**: pergunte se houve trabalho não-código (PRs revisados, reuniões, planejamento). Se sim, postar só no Slack sem mexer no Jira.
- **Commit sem issue key**: liste e pergunte a qual card associar (ou se cria um novo, ou se ignora).
- **Card com assignee diferente**: alerte antes de comentar — pode ser que tenha pareado e o assignee não é o usuário.
- **Status atual já é Done**: não comente "progresso" — comente nota final só se for relevante.

## Não faça

- ❌ Postar no Slack sem preview
- ❌ Assumir canal Slack — sempre perguntar (a menos que skill defina default)
- ❌ Comentar em card de outra pessoa sem alertar
- ❌ Esquecer fuso (use data local — o `currentDate` da memória é a fonte)
