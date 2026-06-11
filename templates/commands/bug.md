---
description: Cria card de bug no Jira (com preview e approval) e opcionalmente comunica no Slack.
argument-hint: <descrição rápida do bug>
allowed-tools: Read, Bash, Grep, Glob, AskUserQuestion
---

Você vai criar um card de bug no Jira seguindo o fluxo **fanti-flow**.

**Input do usuário**: $ARGUMENTS

## Passos

1. **Carregar config**: leia `~/.claude/skills/fanti-flow-config/SKILL.md`. Use os templates e padrões dele.

2. **Identificar projeto Jira** seguindo a ordem definida na skill:
   - Flag `--project=KEY` no input?
   - CWD bate com algum repo da tabela?
   - Branch atual tem prefixo de issue key?
   - Senão, pergunte ao usuário via AskUserQuestion (com lista de projetos da skill).

3. **Coletar informações faltantes** via AskUserQuestion (perguntas curtas e práticas):
   - **Severidade**: Critical / High / Medium / Low
   - **Impacto**: quem é afetado e como (1 frase)
   - **Onde**: módulo/rota/componente afetado (se o usuário souber)
   - **Reprodução**: passos curtos ou "ainda investigando"

   Se a descrição inicial já cobre algum item, NÃO pergunte de novo — só preencha.

4. **Buscar duplicatas** no Jira via `searchJiraIssuesUsingJql`:
   - JQL: `project = <KEY> AND issuetype in (Bug, Problema) AND text ~ "<2-3 palavras-chave>" AND created > -30d`
   - Se houver resultado relevante, mostre ao usuário e pergunte se é o mesmo bug.

5. **Montar payload** seguindo o **template "Bug card"** da skill:
   - Issue type: o nome usado no workspace (geralmente `Bug` em EN ou `Problema` em PT) — ver skill
   - Priority: derivar da severidade (só se o projeto tiver esse campo — checar via `getJiraIssueTypeMetaWithFields`)
   - Labels: `auto-fanti-flow` + qualquer que o usuário pediu
   - Reporter + Assignee: o usuário (account_id da skill / `atlassianUserInfo`)
   - Descrição no idioma definido na skill (default: português)

6. **Preview** em bloco markdown legível:
   ```
   ━━━ PREVIEW DO CARD ━━━
   Project: <KEY>
   Type: <Bug | Problema>
   Priority: <...>
   Title: <...>
   Labels: <...>

   <descrição renderizada>
   ━━━━━━━━━━━━━━━━━━━━━━
   ```
   Pergunte: "Pode criar? (sim / ajustar / cancelar)"

7. **Se aprovado**: crie via `mcp__atlassian__createJiraIssue`. Reporte com link clicável.

8. **Slack opcional**: pergunte "comunicar no Slack? (sim / não)". Se sim:
   - Pergunte o canal (use `slack_search_channels` se precisar listar) — a menos que a skill defina canal default
   - Monte mensagem curta: ":bug: Novo bug registrado: <KEY> — <título>. Severidade: <X>. <link>"
   - Preview → approval → envio

9. **Salvar contexto**: guarde a issue key criada — se o usuário rodar `/bug-close` em seguida sem especificar key, use essa.

## Não faça

- ❌ Criar sem buscar duplicata
- ❌ Postar no Slack sem perguntar o canal (a menos que skill defina default)
- ❌ Escrever o card em idioma diferente do definido na skill
- ❌ Esquecer o label `auto-fanti-flow`
- ❌ Pular o preview "porque é simples"
