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

## 7. Gatilhos de Skills (quando invocar automaticamente)

Agentes e skills não se auto-ativam por contexto — **é sua responsabilidade**
invocar a skill certa no momento certo. Use estes gatilhos como checklist:

| Momento | Skill/Agente | Motivo |
|---|---|---|
| Finalizei endpoint ou handler | `/security-checklist` | Garante input validation, auth, rate limit |
| Finalizei componente/tela | `/ui-review-checklist` | Acessibilidade, estados, responsividade |
| Vou escrever migration | `/sql-templates` | Expand-contract, NOT VALID/VALIDATE |
| Vou revisar/abrir PR | `/pr-template` + `pr-reviewer` | Descrição padrão + checklist de qualidade |
| Recebi resumo de reunião | `/meet-dod` | Vira DoD estruturada |
| Decisão técnica não-óbvia | `/architecture-decision` | ADR registra contexto + alternativas |
| Priorizar 2+ features | `/product-templates` (RICE) | Evita priorização por bias |
| Novo módulo Python | `/python-patterns` | Repository, Settings, FastAPI setup |

## 8. Combos de Agentes (multi-domínio)

Problemas complexos quase sempre envolvem múltiplas áreas. Use combos:

| Cenário | Agentes a invocar (em paralelo) | Quem sintetiza |
|---|---|---|
| FastAPI + RDS + AWS infra | `python-specialist` + `aws-specialist` + `database-specialist` | você (ou `architect` se trade-offs conflitantes) |
| Frontend com state complexo + design system | `react-specialist` + `uxui-specialist` | você |
| Feature nova de ponta a ponta | `architect` → stack specialist → `test-specialist` → `security-specialist` → `pr-reviewer` | sequencial, não paralelo |
| Incidente em produção | `database-specialist` (se query) OU stack specialist + `security-specialist` | você, com base nos sintomas |
| Refactor grande | `architect` (decisão) + `implementation-planner` (tasks) + stack specialist | sequencial |

**Regra:** se 2 agentes der recomendações conflitantes, invoque `architect`
pra mediar com trade-offs explícitos.

## 9. Delegação vs Resposta Direta

Nem toda pergunta precisa de subagent. Decida pelo custo-benefício:

**Delegue pra subagent quando:**
- Task exige expertise profunda numa área específica
- Você quer output isolado, sem poluir contexto principal
- Há múltiplas áreas paralelas (use agents em paralelo)
- Resposta vai além de 400 palavras de conhecimento especializado

**Responda direto quando:**
- Pergunta é genérica ou de preferência ("TypeScript ou JavaScript?")
- Você tem o conhecimento e o contexto cabe em 1-2 parágrafos
- Task é orquestração (decidir qual agent usar, resumir múltiplos outputs)
- Usuário explicitamente quer resposta rápida

## 10. Workflow

- SEMPRE leia o CLAUDE.md do projeto antes de codar (se existir em `.claude/`)
- SEMPRE siga os padrões JÁ existentes no projeto — não invente novos
- ANTES de sugerir branch/commit, consulte o histórico do projeto com `git log` e `git branch`
- ANTES de declarar "pronto" feature não-trivial, passe por `/security-checklist` (se backend) ou `/ui-review-checklist` (se frontend)

## 11. Protocolo de Sessão

Ao iniciar uma sessão de trabalho:
1. **Confirme o projeto** — se não estiver óbvio pelo diretório, pergunte
2. **Carregue contexto** — leia o CLAUDE.md do projeto se existir
3. **Para tasks complexas** — pergunte se quer que use extended thinking
