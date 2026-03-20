# claudião

CLI que instala e gerencia agentes, skills e plugins para o [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

> Seu Claude Code com esteroides. **18 agentes + 9 skills + 3 plugins + CLAUDE.md global + wizard de criação + doctor** — tudo em um comando.

## Pra quem é isso?

Pra devs que já usam o [Claude Code](https://docs.anthropic.com/en/docs/claude-code) e querem turbinar com agentes especializados, skills prontas e configuração global — sem montar tudo na mão.

Funciona com **qualquer stack**. Os agentes cobrem Node.js, Python, React, AWS, Azure, GCP, bancos de dados e mais.

> **Importante:** O CLAUDE.md global vem com um template **opinado** (pt-BR, TypeScript strict, nível sênior) como ponto de partida. Ele foi feito pra ser customizado — depois do `init`, edite `~/.claude/CLAUDE.md` pra refletir sua stack, idioma e estilo. Se você usa Go, Java, ou qualquer outra linguagem, basta ajustar.

## O que é isso?

O [Claude Code](https://docs.anthropic.com/en/docs/claude-code) é uma CLI da Anthropic que usa IA pra codar junto com você. O claudião é uma **ferramenta de setup** que configura o Claude Code com agentes, skills e regras globais. Você roda o claudião uma vez (ou quando quiser atualizar), e depois usa o Claude Code normalmente — o claudião não precisa ficar rodando.

### O que vem incluso

| O que | Quantidade | Descrição |
|-------|-----------|-----------|
| **Agentes** | 18 | Subagents que o Claude Code invoca automaticamente pelo contexto (ex: perguntou sobre AWS? o `aws-specialist` entra em ação) |
| **Skills** | 9 | Slash commands com templates e checklists prontos (ex: `/security-checklist` antes de deploy) |
| **CLAUDE.md global** | 1 | Regras universais de código, git workflow e referência a todos os agentes/skills — muda o comportamento do Claude Code em **todos** os seus projetos |
| **Wizard de criação** | — | Crie seus próprios agentes e skills com um wizard interativo |
| **Doctor** | — | Diagnóstico automático de problemas de instalação |

Além disso, o claudião facilita a instalação de **3 plugins de terceiros** (da comunidade, não mantidos por este projeto) pra TDD, planejamento e memória entre sessões.

Tudo instalado via symlinks — edite os templates e as mudanças refletem instantaneamente no Claude Code, sem reinstalar. Funciona solo ou em time (com [repo compartilhado](#repo-externo-avançado)).

## Pré-requisitos

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)

## Instalação

```bash
npm install -g claudiao
```

## Setup rápido

```bash
claudiao init
```

Isso instala tudo interativamente:

1. **CLAUDE.md global** — regras universais em `~/.claude/CLAUDE.md`
2. **18 agentes** — symlinks em `~/.claude/agents/`
3. **9 skills** — symlinks em `~/.claude/skills/`
4. **Plugins** — pergunta se quer instalar extras

Depois, abra o Claude Code em qualquer projeto (`claude`) e os agentes já estão ativos. Não precisa fazer mais nada.

## Como funciona

```
claudiao init
     |
     v
~/.claude/
  ├── CLAUDE.md              → Regras globais (conventional commits, TypeScript strict, etc.)
  ├── agents/
  │   ├── aws-specialist.md  → symlink pro template bundled
  │   ├── react-specialist.md
  │   └── ... (18 agentes)
  └── skills/
      ├── security-checklist/ → symlink pro template bundled
      ├── pr-template/
      └── ... (9 skills)
```

**Symlinks** permitem live reload — se você editar um template (ou rodar `claudiao update`), a mudança reflete no Claude Code sem reinstalar.

## Usando agentes

Agentes são ativados **automaticamente** pelo Claude Code conforme o contexto da sua pergunta. Você não precisa fazer nada além de conversar normalmente:

```
você: "essa query tá lenta, o que posso fazer?"
       → Claude Code invoca o database-specialist automaticamente

você: "preciso subir isso na AWS com Fargate"
       → aws-specialist entra em ação

você: "faz um code review desse PR"
       → pr-reviewer analisa com severidade (blocker/importante/sugestão)
```

Não existe comando pra "ativar" um agente — o Claude Code lê os arquivos `.md` em `~/.claude/agents/` e decide qual usar baseado na sua mensagem. Quanto mais específico você for, melhor a escolha do agente.

**Dica:** você pode forçar um agente mencionando ele no prompt: *"use o architect pra avaliar essa decisão"*.

## Usando skills

Skills são **slash commands** que você digita dentro do Claude Code. Diferente dos agentes, você invoca manualmente:

```
você: /security-checklist
       → Claude Code gera um checklist OWASP completo pro seu projeto

você: /pr-template
       → Gera um PR formatado com título, descrição, checklist e labels

você: /architecture-decision
       → Template de ADR pronto pra você preencher

você: /sql-templates
       → Templates SQL pra diagnóstico de performance, migrations zero-downtime
```

Skills podem receber contexto adicional:

```
você: /meet-dod [cola o resumo da reunião aqui]
       → Transforma em Definition of Done estruturada

você: /python-patterns repository
       → Gera boilerplate do Repository Pattern pronto pra usar
```

## Usando o CLAUDE.md global

O CLAUDE.md global é o **maior diferencial** do claudião. Ele configura o comportamento do Claude Code em **todos** os seus projetos de uma vez, sem precisar copiar regras projeto a projeto.

O `claudiao init` instala um `~/.claude/CLAUDE.md` que define:

- **Idioma**: respostas em português brasileiro
- **Nível**: sênior — sem explicar o básico
- **Regras de código**: TypeScript strict, validação de inputs, logs estruturados, sem secrets hardcoded
- **Git workflow**: conventional commits em inglês, branch naming, PR format
- **Referência**: lista de todos os agentes e skills disponíveis

Na prática, isso significa que ao abrir `claude` em qualquer projeto, ele já sabe:
- Usar conventional commits (`feat(auth): add OAuth2 login`)
- Responder em pt-BR
- Seguir TypeScript strict mode
- Validar inputs públicos com Zod/class-validator
- Nunca engolir exceção silenciosamente

> **Importante:** O template vem opinado (pt-BR, nível sênior, TypeScript strict) como **ponto de partida**. Você **deve** customizá-lo depois do `init` pra refletir sua stack, idioma e estilo. Usa Python? Troque os exemplos de TypeScript. Prefere inglês? Mude a diretiva de idioma. Basta editar `~/.claude/CLAUDE.md`.

Se você já tem um `~/.claude/CLAUDE.md` próprio, o `claudiao init` pergunta antes de sobrescrever.

## Usando plugins

Plugins são extensões **de terceiros**, mantidas pela comunidade (não pelo claudião). O claudião apenas facilita a instalação executando o comando correto pra cada plugin. Depois de instalado, o plugin funciona direto no Claude Code — o claudião não precisa estar rodando.

```bash
# Instala via claudião (ele resolve o mecanismo certo pra cada plugin)
claudiao install plugin superpowers     # usa: claude /plugin install superpowers
claudiao install plugin get-shit-done   # usa: npx get-shit-done-cc@latest
claudiao install plugin claude-mem      # usa: claude /plugin install claude-mem

# Depois, no Claude Code (sem o claudião), o plugin já está ativo:
você: "vamos fazer TDD nessa feature"
       → superpowers entra em modo red-green-refactor automaticamente
```

| Plugin | Mecanismo de instalação | Como usar depois de instalar |
|--------|------------------------|------------------------------|
| **superpowers** | `claude /plugin install` | Pede TDD e ele força red-green-refactor. Pede debug e ele segue 4 fases sistemáticas. |
| **get-shit-done** | `npx` (standalone) | Pede pra planejar uma feature e ele cria spec, divide em fases (discuss → plan → execute → verify) |
| **claude-mem** | `claude /plugin install` | Memoriza decisões entre sessões automaticamente via SQLite + busca vetorial |

## Comandos

### Configuração

```bash
claudiao init              # Setup completo interativo
claudiao update            # Atualiza templates e recria symlinks (ver detalhes abaixo)
claudiao doctor            # Diagnostica problemas de instalação
```

**`claudiao update`** faz duas coisas:
1. Se você usa [repo externo](#repo-externo-avançado), roda `git pull` pra puxar as versões mais recentes dos seus agentes/skills
2. Recria os symlinks em `~/.claude/agents/` e `~/.claude/skills/`, garantindo que apontem pros templates atualizados (bundled ou do repo externo)

Útil depois de atualizar o claudião via `npm update -g claudiao` (novos agentes/skills bundled) ou quando o time atualizou o repo compartilhado.

**`claudiao doctor`** verifica: Claude Code instalado, diretório `~/.claude/` existe, CLAUDE.md global OK, integridade dos symlinks de agentes e skills, e config do repo externo. Se algo estiver quebrado, sugere o comando pra corrigir.

### Criar

```bash
# Wizard interativo — pergunta nome, descrição, tools, model, princípios, anti-patterns
claudiao create agent
claudiao create agent "Especialista em Go com foco em microservices e gRPC"

# Cria uma skill (slash command) com template/checklist
claudiao create skill
claudiao create skill "Checklist de deploy para produção"
```

O wizard gera o arquivo `.md` com frontmatter YAML diretamente em `~/.claude/agents/` (ou `~/.claude/skills/{name}/SKILL.md`) e cria o symlink automaticamente. Se você usa [repo externo](#repo-externo-avançado), o arquivo é criado no repo e o symlink aponta pra lá. O agente/skill fica disponível na próxima vez que você abrir o Claude Code (ou na próxima mensagem, se já estiver aberto).

### Listar

```bash
claudiao list agents       # Lista agentes instalados por categoria
claudiao list skills       # Lista skills (slash commands)
claudiao list plugins      # Lista plugins da comunidade disponíveis
```

### Instalar plugins

```bash
claudiao install plugin superpowers      # TDD, debugging, code review
claudiao install plugin get-shit-done    # Planejamento spec-driven
claudiao install plugin claude-mem       # Memória entre sessões
```

### Remover

```bash
claudiao remove agent go-specialist
claudiao remove skill deploy-checklist
```

## Agentes incluídos (18)

| Categoria | Agente | O que faz |
|-----------|--------|-----------|
| **Desenvolvimento** | `react-specialist` | Componentes, hooks, performance, Server Components, Next.js |
| | `nodejs-specialist` | APIs NestJS, filas, autenticação, Prisma |
| | `python-specialist` | FastAPI, ETL, data pipelines, pandas, ML |
| | `database-specialist` | Queries, indexes, migrations, modelagem, performance |
| | `uxui-specialist` | Design system, acessibilidade, CSS/Tailwind, responsividade |
| **Cloud & Infra** | `aws-specialist` | Arquitetura AWS, Terraform, ECS/Fargate, custos |
| | `azure-specialist` | App Service, AKS, Functions, Bicep |
| | `gcp-specialist` | Cloud Run, GKE, BigQuery, Terraform GCP |
| **Qualidade** | `pr-reviewer` | Code review com severidade (blocker/importante/sugestão) |
| | `test-specialist` | Estratégia de testes, TDD, cobertura, mocks |
| | `security-specialist` | OWASP Top 10, SAST, secrets, auth, hardening |
| **Planejamento** | `architect` | Trade-offs, ADRs, diagramas, design de sistemas |
| | `implementation-planner` | Quebra features em tasks com dependências e riscos |
| | `idea-refiner` | Brainstorming socrático, MVP, viabilidade técnica |
| **Gestão** | `project-manager` | Sprints, estimativas, riscos, roadmaps |
| | `product-owner` | Priorização, user stories, métricas de produto |
| | `prompt-engineer` | Criar e otimizar prompts para LLMs |
| | `dod-specialist` | Definition of Done mensurável e progressiva |

## Skills incluídas (9)

| Comando | O que faz |
|---------|-----------|
| `/architecture-decision` | Template de ADR com contexto, opções, trade-offs e decisão |
| `/meet-dod` | Transforma resumo de reunião (Meet/Zoom) em Definition of Done estruturada |
| `/pm-templates` | Templates de User Story, Sprint Planning, Retrospectiva e ADR |
| `/pr-template` | Template padronizado de PR com checklist de review e labels |
| `/product-templates` | PRD, RICE scoring, product brief e go-to-market |
| `/python-patterns` | Boilerplates Python: Repository Pattern, Settings, FastAPI, pytest |
| `/security-checklist` | Checklist pré-deploy com OWASP Top 10, headers, secrets, dependências |
| `/sql-templates` | Templates SQL para diagnóstico de performance, migrations zero-downtime e indexes |
| `/ui-review-checklist` | 30+ items de revisão de UI: hierarquia visual, acessibilidade, responsividade |

## Plugins da comunidade

> **Nota:** Estes plugins são projetos independentes, mantidos por seus respectivos autores. O claudião apenas facilita a instalação.

| Plugin | O que faz |
|--------|-----------|
| [superpowers](https://github.com/obra/superpowers) | TDD enforced (red-green-refactor), debugging sistemático em 4 fases, code review, git worktrees |
| [get-shit-done](https://github.com/gsd-build/get-shit-done) | Planejamento spec-driven com fases (discuss, plan, execute, verify) e estado persistido |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Memória persistente entre sessões via SQLite + busca vetorial |

## Repo externo (avançado)

Se você mantém seus agentes/skills num repo Git separado, configure em `~/.claude/.claudiao.json`:

```json
{
  "repoPath": "/caminho/para/seu/repo"
}
```

O repo deve seguir a mesma estrutura do diretório `templates/`:

```
seu-repo/
  ├── agents/
  │   ├── meu-agente.md
  │   └── outro-agente.md
  └── skills/
      └── minha-skill/
          └── SKILL.md
```

O claudião prioriza o repo externo sobre os templates bundled. `claudiao update` roda `git pull` + relink automaticamente. Isso é útil pra times que compartilham agentes/skills via Git.

## Fluxo completo: do zero ao uso

```bash
# 1. Instala a CLI
npm install -g claudiao

# 2. Setup (agentes + skills + CLAUDE.md + plugins)
claudiao init

# 3. Abre o Claude Code em qualquer projeto
cd meu-projeto
claude

# 4. Usa normalmente — agentes ativam pelo contexto
você: "essa API tá retornando 500 intermitente"
       → nodejs-specialist investiga

# 5. Usa skills quando precisar de templates
você: /pr-template
       → PR formatado pronto

# 6. Cria agente personalizado pro seu domínio
claudiao create agent "Especialista em GraphQL com Apollo Server"

# 7. Mantém atualizado
claudiao update

# 8. Algo quebrou?
claudiao doctor
```

## Guia de best practices

O projeto inclui um **[guia completo de best practices](./templates/CLAUDE-CODE-BEST-PRACTICES.md)** com:

- Workflows reais (feature nova, bug fix, code review, onboarding, deploy)
- Como combinar agentes + skills + plugins num fluxo completo
- Níveis de raciocínio (think, megathink, ultrathink)
- Subagents: quando usar e quando não usar
- Dicas práticas (sessões paralelas, `/clear` entre tarefas, atalhos)

Exemplo — workflow de feature nova:

```
1. /architecture-decision     → documenta a decisão técnica
2. Conversa com o Claude      → architect + implementation-planner quebram em tasks
3. Implementa                 → react-specialist / nodejs-specialist ajudam no código
4. /security-checklist        → verifica antes de subir
5. /pr-template               → PR formatado e pronto pra review
```

## Desinstalar

> O claudião ainda não tem um comando `uninstall`. Por enquanto, a remoção é manual:

```bash
# Remove todos os symlinks e o CLAUDE.md global
rm -rf ~/.claude/agents/ ~/.claude/skills/ ~/.claude/CLAUDE.md

# Remove a config do claudião
rm -f ~/.claude/.claudiao.json

# Remove a CLI
npm uninstall -g claudiao
```

Plugins precisam ser removidos separadamente, cada um pelo seu mecanismo:

```bash
# Plugins instalados via claude /plugin install
claude /plugin remove superpowers
claude /plugin remove claude-mem

# get-shit-done (instalado via npx) não requer remoção manual
```

## Licença

MIT
