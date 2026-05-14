## 1. Identidade

Responda sempre em **português brasileiro (pt-BR)**.
- Seja direto e objetivo — não precisa explicar o básico
- Use exemplos práticos sempre que possível
- SÓ entre no detalhe quando eu pedir explicitamente
- Nível das respostas: sênior — assuma que entendo arquitetura, patterns e trade-offs

## 2. Regras Universais de Código

- **TypeScript strict mode** em todo projeto TS — sem `any`, tipagem completa
- **Validação de input** em todo endpoint público (Zod, class-validator, Pydantic)
- **Erros explícitos** — nunca engolir exceção silenciosamente
- **Testes** — toda feature nova tem pelo menos teste unitário
- **Sem secrets hardcoded** — use variáveis de ambiente ou secrets manager
- **Conventional commits** em inglês: `type(scope): descrição`
- **Logs estruturados** em JSON (nunca console.log em produção)
- **Idempotência** em APIs e jobs sempre que possível

## 3. Git: Branches e Commits

### Commits
- SEMPRE use conventional commits em inglês
- Formato: `type(scope): descrição curta`
- Types: feat, fix, chore, refactor, docs, test, ci, perf, style
- Escopo: módulo ou área afetada
- Descrição: imperativo, lowercase, sem ponto final
- ANTES de sugerir commit, verifique o padrão do projeto com `git log --oneline -10`
- Se o projeto usar prefixo com ID de ticket, siga o padrão
- Exemplos:
  - `feat(auth): add OAuth2 login with Google`
  - `fix(orders): resolve race condition on payment processing`
  - `refactor(users): extract validation to shared util`

### Branches
- SEMPRE sugira nomes de branch em inglês
- ANTES de sugerir, verifique o padrão existente com `git branch -a | head -20`
- Padrão default: `feature/`, `fix/`, `hotfix/`, `chore/`

### Pull Requests
- Título: conventional commit style em inglês
- Body: em português com seções: O que foi feito, Por quê, Como testar

## 4. Auto Skill Creation

Quando identificar uma tarefa complexa e recorrente que exija conhecimento especializado não coberto pelas skills existentes, crie uma nova skill em `~/.claude/skills/` ANTES de executar a tarefa. Inclua:
- Frontmatter com name, description, allowed-tools, model
- Seção "Quando ativar" com triggers claros
- Templates ou checklists prontos para uso
- Exemplos de output ideal quando aplicável

## 5. Skills Globais Disponíveis

| Skill | Descrição | Trigger |
|-------|-----------|---------|
| `/architecture-decision` | ADR template para decisões técnicas | Decisão de arquitetura |
| `/meet-dod` | Resumo de reunião → Definition of Done | Quando colar resumo de meeting |
| `/pm-templates` | User Story, ADR, Sprint Planning, Retro | Artifacts de gestão de projeto |
| `/pr-template` | Template padronizado de PR com checklist | Criar ou formatar PR |
| `/product-templates` | PRD, RICE scoring, GTM checklist | Documentação de produto |
| `/python-patterns` | Repository Pattern, Settings, FastAPI, pytest | Novo módulo Python ou boilerplate |
| `/security-checklist` | Checklist pré-deploy (OWASP, headers, secrets) | Antes de deploy ou audit |
| `/sql-templates` | Templates SQL para PostgreSQL (diagnóstico, migrations, indexes) | Investigação de performance ou migration |
| `/ui-review-checklist` | Checklist de revisão de UI (30+ items) | Antes de PR de frontend |

## 6. Agentes Especializados

| Agente | Quando invocar |
|--------|---------------|
| `architect` | Decisões de arquitetura, trade-offs, ADRs, design de sistemas |
| `aws-specialist` | Arquitetura AWS, IaC, CI/CD, custos, segurança cloud |
| `azure-specialist` | Azure App Service, AKS, Functions, CosmosDB, Bicep |
| `daily-reporter` | Orquestra fluxo Jira+Slack (fanti-flow) — usado pelos commands `/bug`, `/bug-close`, `/eod`, `/plan` |
| `database-specialist` | Modelagem, queries, indexes, migrations, performance |
| `dod-specialist` | Criar/revisar Definition of Done |
| `gcp-specialist` | Cloud Run, GKE, BigQuery, Functions, Terraform GCP |
| `idea-refiner` | Refinamento de ideias, brainstorming socrático, escopo MVP |
| `implementation-planner` | Quebrar features em tasks, dependências, ordem de execução |
| `nodejs-specialist` | Backend Node.js/NestJS, APIs, filas, autenticação |
| `pr-reviewer` | Code review, PR review, checklist de qualidade |
| `product-owner` | Priorização, MVPs, user stories, métricas de produto |
| `project-manager` | Sprints, épicos, estimativas, riscos, roadmaps |
| `prompt-engineer` | Criar/otimizar prompts para LLMs |
| `python-specialist` | Python, FastAPI, ETL, data pipelines, ML |
| `react-specialist` | React, Next.js, estado, performance, testing |
| `security-specialist` | OWASP Top 10, SAST, secrets, auth, hardening |
| `test-specialist` | Estratégia de testes, TDD, cobertura, qualidade de testes |
| `uxui-specialist` | UX/UI, design system, acessibilidade, CSS/Tailwind |

## 7. Workflow

- SEMPRE leia o CLAUDE.md do projeto antes de codar (se existir em `.claude/`)
- SEMPRE siga os padrões JÁ existentes no projeto — não invente novos
- ANTES de sugerir branch/commit, consulte o histórico do projeto com git log e git branch

## 8. Protocolo de Sessão

Ao iniciar uma sessão de trabalho:
1. **Confirme o projeto** — se não estiver óbvio pelo diretório, pergunte
2. **Carregue contexto** — leia o CLAUDE.md do projeto se existir
3. **Para tasks complexas** — pergunte se quer que use extended thinking

## 9. Fluxo Jira+Slack (fanti-flow)

Sistema de slash commands pra comunicação com Jira e Slack via Claude Code, com **preview + approval obrigatório** antes de qualquer escrita.

**Pré-requisito**: MCPs Atlassian (`https://mcp.atlassian.com/v1/mcp`, Streamable HTTP) e Slack (`claude.ai Slack`) configurados e autenticados via `/mcp`.

### Quando usar cada command

| Command | Quando | Exemplo |
|---|---|---|
| `/bug <descrição>` | Bug acabou de aparecer | `/bug login retorna 500 com email com ponto antes do @` |
| `/bug-close [KEY]` | Terminou a correção, vai documentar resolução | `/bug-close` (usa último bug da sessão) ou `/bug-close GPT-456` |
| `/eod [contexto]` | Fim do dia (17h-18h) | `/eod` ou `/eod hoje teve reunião com produto sobre relatórios` |
| `/plan <feature>` | Demanda nova chegou, antes de codar | `/plan adicionar exportação CSV nos relatórios` |

### Como o sistema decide o projeto Jira

Em ordem: 1) flag `--project=KEY` no input  2) CWD do repo  3) prefixo da branch (`LOV-123`)  4) último commit  5) pergunta ao usuário.

### Princípios não-negociáveis

- **Nada vai pro Jira/Slack sem aprovação explícita** — sempre preview + prompt `sim` / `ajustar` / `cancelar`
- **Pergunta o canal Slack** antes de postar (política: decidir na hora)
- **Busca duplicata** antes de criar card — não polui board
- **Label `auto-fanti-flow`** em tudo que cria — rastreabilidade

### Config e personalização

- Templates de cards, project keys e workflow do projeto principal: skill `fanti-flow-config` (`~/.claude/skills/fanti-flow-config/SKILL.md`)
- Orquestrador: agente `daily-reporter`

### Fluxo típico do dia

| Hora | Situação | Command |
|---|---|---|
| manhã | bug aparece | `/bug` |
| meio-dia | feature nova chega | `/plan` |
| tarde | bug corrigido | `/bug-close` |
| 18h | fim do expediente | `/eod` |
