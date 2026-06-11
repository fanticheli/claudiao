---
description: Quebra uma feature em épico + stories no Jira com AC, prazos e dependências.
argument-hint: <descrição da feature ou caminho de doc/PRD>
allowed-tools: Read, Bash, Grep, Glob, AskUserQuestion, Agent
---

Você vai planejar uma feature: criar um épico no Jira e quebrar em stories bem detalhadas. Fluxo **fanti-flow**.

**Input do usuário**: $ARGUMENTS

## Passos

1. **Carregar config**: leia `~/.claude/skills/fanti-flow-config/SKILL.md`.

2. **Coletar contexto da feature**:
   - Se $ARGUMENTS é um caminho de arquivo, leia o conteúdo.
   - Senão, use $ARGUMENTS como descrição inicial.
   - Pergunte via AskUserQuestion (4 perguntas curtas):
     - **Objetivo de negócio**: qual problema/oportunidade resolve?
     - **Quem usa**: persona ou stakeholder
     - **Prazo desejado**: deadline ou sprint alvo (data absoluta)
     - **Restrições conhecidas**: tech, regulatório, dependências externas

3. **Identificar projeto Jira** (skill define a ordem). Pra feature, geralmente é o projeto onde o épico vai morar — confirme com o usuário.

4. **Delegar a quebra técnica** pro agente `implementation-planner` (via Agent tool):
   ```
   Agent(subagent_type=implementation-planner, prompt=<feature + contexto + restrições>)
   ```
   Espere retorno com lista de tasks contendo: título, contexto, solução proposta, AC, dependências, estimativa.

5. **Revisar com o usuário** — apresente a quebra proposta em árvore:
   ```
   ÉPICO: <título>
   ├── Story 1: <título> [<estim>] (deps: -)
   ├── Story 2: <título> [<estim>] (deps: Story 1)
   ├── Story 3: <título> [<estim>] (deps: Story 1)
   └── Story 4: <título> [<estim>] (deps: Story 2, 3)
   ```
   Pergunte: "Essa quebra faz sentido? (sim / ajustar / refazer)"
   Aceite edições antes de prosseguir.

6. **Montar payloads**:

   **Épico** (template "Plan / Épico" da skill):
   ```
   ## Objetivo
   ## Escopo
   - Incluído / Fora de escopo
   ## Métricas de sucesso
   ## Premissas e riscos
   ```

   **Cada story** (template "Plan / Story" da skill):
   ```
   ## Contexto
   ## Solução proposta
   ## Critérios de aceite
   ## Notas técnicas
   ## Dependências
   ## Estimativa
   ```

   Todas com label `auto-fanti-flow`.

7. **Preview hierárquico completo**:
   ```
   ━━━ PLANO DE IMPLEMENTAÇÃO ━━━

   ÉPICO: <título>
   ---
   <descrição renderizada>

   STORY 1: <título>
   ---
   <descrição renderizada>

   STORY 2: <título>
   ...
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
   Pergunte: "Criar tudo no Jira? (sim / ajustar story X / cancelar)"

8. **Se aprovado**:
   - Crie o épico primeiro (`createJiraIssue` issuetype=Epic). Guarde a key.
   - Crie cada story (`createJiraIssue` issuetype=Story) com `customfield_<epicLink>` apontando pro épico.
     - Descubra o customfield correto via `getJiraIssueFields` se ainda não souber.
   - Reporte cada KEY criada.

9. **Comunicação Slack**:
   - Pergunte se posta. Se sim, pergunte canal.
   - Mensagem (preview + approval):
     ```
     :rocket: *Iniciando feature: <título do épico>*

     Objetivo: <1 frase>
     Prazo: <data>

     Cards criados:
     • <EPIC-KEY> <título> (épico)
     • <STORY-KEY-1> <título>
     ...

     Vou começar por <primeira story>. Dúvidas / ajustes aqui na thread.
     ```

10. **Persistir** em memória: a feature, o épico criado, prazo. Útil pro `/eod` referenciar.

## Heurísticas de quebra

- Stories devem caber em 1-3 dias cada (se maior, quebrar)
- Sempre incluir uma story de "testes / observabilidade" se a feature for backend
- Sempre incluir AC verificáveis (não "funcionar bem")
- Marcar dependências explícitas — não deixar implícito

## Não faça

- ❌ Criar 10 stories sem revisar individualmente com o usuário
- ❌ Estimar sem ler o código existente (use Read/Grep no repo)
- ❌ Inventar epic link customfield — descubra via MCP
- ❌ Postar no Slack antes de criar os cards (sem cards = nada pra referenciar)
