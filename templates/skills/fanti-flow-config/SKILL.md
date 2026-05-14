---
name: fanti-flow-config
description: Config central do fluxo Jira+Slack (fanti-flow). Project keys, canais, templates e padrões de comunicação. Editar com dados do seu workspace antes do primeiro uso.
---

# fanti-flow-config

Single source of truth pro fluxo de automação Jira+Slack via Claude Code. Os slash commands `/bug`, `/bug-close`, `/eod` e `/plan` leem essa skill antes de montar payloads.

> **Antes do primeiro uso**: preencha os campos marcados com `<EDITAR>`. O agente `daily-reporter` pode descobrir muita coisa via MCP — mas você precisa pelo menos preencher o site Atlassian e os repos locais que usa.

## Identidade

- **Usuário**: `<EDITAR — seu nome>`
- **Email Atlassian**: `<EDITAR — descobrir via mcp__atlassian__atlassianUserInfo>`
- **Account ID Atlassian**: `<EDITAR — descobrir via mcp__atlassian__atlassianUserInfo>`
- **Jira Cloud**: `<EDITAR — ex: empresa.atlassian.net>`
- **cloudId**: `<EDITAR — descobrir via mcp__atlassian__getAccessibleAtlassianResources>`
- **Slack**: workspace `<EDITAR>` (autenticado via MCP)

## Projetos Jira

Preencha após rodar `getVisibleJiraProjects` (o `daily-reporter` faz isso automaticamente na primeira execução de `/bug`):

| Key | Nome | Issue types | Observação |
|---|---|---|---|
| `<KEY-1>` | `<nome>` | `<tipos disponíveis>` | seu time principal |
| ... | ... | ... | ... |

### Mapa repo → projeto

Pra `/eod` saber casar commits com cards e `/bug` saber em qual projeto criar:

| Repo local | Project key default |
|---|---|
| `<EDITAR — ex: ~/projetos/meu-app>` | `<KEY>` |

### Workflow do projeto principal (transitions)

Descobrir uma vez via `getTransitionsForJiraIssue` num issue exemplo:

| Transition ID | Nome | Status destino |
|---|---|---|
| `<id>` | `<nome>` | `<status>` |

> Outros projetos podem ter IDs diferentes — `daily-reporter` sempre chama `getTransitionsForJiraIssue` antes de transicionar.

## Identificação de projeto (ordem)

Ao rodar qualquer command, o agente identifica o projeto Jira nesta ordem:

1. **`--project=KEY`** explícito na invocação do command
2. **CWD** — match `~/projetos/<repo>` com a tabela acima
3. **Branch** — se branch tem prefixo `LOV-123`, etc., usar o prefixo
4. **Último commit** — extrair issue key do `git log -1 --pretty=%s`
5. **Perguntar** via AskUserQuestion

## Canais Slack

**Política padrão**: decidir na hora cada vez. Sempre perguntar antes de postar — nunca assumir canal default. Edite essa política se preferir um canal fixo.

Cachear opções descobertas via `slack_search_channels`:
- A definir após descoberta inicial

## Template: Bug card

Estilo padrão: **narrativa curta + impacto** (não-técnico, pra time misto). Edite se preferir steps-to-reproduce mais técnico.

```markdown
## Resumo
{{1-2 frases descrevendo o bug do ponto de vista do usuário/sistema}}

## Impacto
{{quem é afetado, com que frequência, severidade percebida — se há workaround, citar}}

## Detalhes técnicos
- **Onde**: {{módulo, rota, componente, query}}
- **Quando começou**: {{data/release/commit, se conhecido}}
- **Ambiente**: {{prod / staging / dev — versões relevantes}}

## Como reproduzir
{{passos curtos, só se relevante — pode ser "ainda investigando"}}

## Comportamento esperado vs atual
- Esperado: {{...}}
- Atual: {{...}}
```

Campos do issue Jira:
- **Issue Type**: `<EDITAR — Bug ou Problema, dependendo do idioma do workspace>`
- **Priority**: derivar da severidade (Critical/High/Medium/Low) — confirmar via `getJiraIssueTypeMetaWithFields` se o campo existe no projeto
- **Labels**: `auto-fanti-flow`, mais qualquer que você especificar
- **Reporter/Assignee**: você (account_id descoberto via MCP)

## Template: Bug close (comentário + transition)

Comentário a adicionar antes de mover pra Done:

```markdown
## Resolução
{{1-2 frases do que foi feito}}

## Causa raiz
{{o que estava errado e por quê}}

## Solução
{{abordagem aplicada, com link pros commits/PRs}}

## Arquivos afetados
{{lista curta, agrupada por módulo}}

## Como validar
{{passos pro QA/PM testar a correção}}

## Commits
- {{hash}} {{subject}}
```

Transition: descobrir o ID equivalente a "Done" / "Concluído" / "Resolved" via MCP (varia por workflow).

## Template: EOD (atualização de cards + msg Slack)

**Comentário por card** (formato curto, em português):
```markdown
**Progresso ({{data}})**
{{1-2 frases do que avançou hoje}}

- Commits: {{hashes}}
- Próximo passo: {{...}}
- Blockers: {{nenhum | descrição}}
```

**Msg Slack** (consolidada, 1 mensagem só):
```markdown
:wave: *EOD {{data}}*

*Em andamento*
• {{KEY-1}} {{título}} — {{linha resumindo o progresso}}
• {{KEY-2}} {{título}} — {{...}}

*Concluído hoje*
• {{KEY-3}} {{título}}

*Blockers*
• {{nenhum | descrição com tag de quem precisa ajudar}}
```

## Template: Plan (épico + stories)

**Épico**:
```markdown
## Objetivo
{{o que se quer alcançar e por quê — em termos de valor}}

## Escopo
- Incluído: {{...}}
- Fora de escopo: {{...}}

## Métricas de sucesso
{{como saberemos que deu certo}}

## Premissas e riscos
{{...}}
```

**Cada story**:
```markdown
## Contexto
{{1 parágrafo do problema}}

## Solução proposta
{{abordagem técnica}}

## Critérios de aceite
- [ ] {{AC 1}}
- [ ] {{AC 2}}

## Notas técnicas
{{decisões, trade-offs, refs}}

## Dependências
{{outras stories que precisam vir antes}}

## Estimativa
{{horas ou story points}}
```

## Padrões universais

- **Sempre preview + approval** antes de qualquer write no Jira ou Slack
- **Conventional commits em inglês** — quando referenciar commits, usar o subject original
- **Idioma dos cards e mensagens**: ajuste pro idioma do seu time. Default = português.
- **Labels obrigatórios**: `auto-fanti-flow` em tudo que esses commands criarem (rastreabilidade)
- **Idempotência**: não criar card duplicado. Antes de criar, buscar por título similar via `searchJiraIssuesUsingJql`.

## Pré-requisitos

- **MCP Atlassian** configurado e autenticado:
  ```bash
  claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse --scope user
  ```
  Depois autorizar via `/mcp` no Claude Code (OAuth no browser).
- **MCP Slack** configurado (claude.ai Slack ou equivalente)

## Fluxo de descoberta inicial (rodar uma vez)

O agente `daily-reporter` faz isso automaticamente quando os campos da skill estão vazios:

1. `mcp__atlassian__getAccessibleAtlassianResources` → pegar `cloudId`
2. `mcp__atlassian__atlassianUserInfo` → email e account_id
3. `mcp__atlassian__getVisibleJiraProjects` → listar todos os projetos acessíveis
4. Para cada projeto-alvo: `getJiraProjectIssueTypesMetadata` → confirmar nomes (Bug, Story, Epic, Task, Problema, etc.)
5. `getTransitionsForJiraIssue` num issue exemplo → mapear o transition de fechamento
6. `slack_search_channels` → cachear lista de canais relevantes

Após cada descoberta, **editar essa skill** com os valores reais — eles ficam cacheados pra todas as próximas sessões.
