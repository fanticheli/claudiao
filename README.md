# claudião

CLI que instala e gerencia agentes, skills, hooks e CLAUDE.md global para o [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

> Seu Claude Code no próximo nível. **18 agentes + 9 skills + 5 hooks + statusline de contexto + CLAUDE.md global + wizard de criação + doctor** — tudo em um comando.

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
| **Statusline de contexto** | 1 | Barra no rodapé do Claude Code mostrando dir, branch, modelo, % de contexto usado e custo acumulado da sessão |
| **Wizard de criação** | — | Crie seus próprios agentes e skills com um wizard interativo |
| **Doctor** | — | Diagnóstico automático de problemas de instalação |

Tudo instalado via symlinks — edite os templates e as mudanças refletem instantaneamente no Claude Code, sem reinstalar. Funciona solo ou em time (com [repo compartilhado](#repo-externo-avançado)).

## Pré-requisitos

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)

## Instalação

```bash
npm install -g claudiao
```

> Mudanças por versão em [CHANGELOG.md](./CHANGELOG.md).

## Setup rápido

```bash
claudiao init
```

Isso instala tudo interativamente:

1. **CLAUDE.md global** — regras universais em `~/.claude/CLAUDE.md`
2. **18 agentes** — symlinks em `~/.claude/agents/`
3. **9 skills** — symlinks em `~/.claude/skills/`

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

## Plugins do Claude Code

A partir da v1.4.0, o claudião **não gerencia mais plugins de terceiros**. Pra instalar plugins como `superpowers`, `claude-mem` ou outros disponíveis no marketplace do Claude Code, use o comando nativo:

```bash
claude /plugin install <nome-do-plugin>
```

Plugins e agents/skills/hooks do claudião coexistem pacificamente — cada um gerenciado pela sua ferramenta nativa. Veja a [documentação oficial de plugins](https://docs.claude.com/en/docs/claude-code/plugins).

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
claudiao list agents       # Lista agentes instalados por categoria, com [core|external|local]
claudiao list skills       # Lista skills (slash commands), com coluna de origem
```

A coluna de origem (`core` / `external` / `local`) aparece a partir da v1.2.0 e ajuda a debugar quando um agent/skill vem do pacote bundled, do seu [repo externo](#repo-externo-avançado) ou foi criado manualmente.

### Remover

```bash
claudiao remove agent go-specialist
claudiao remove skill deploy-checklist
```

### Hooks (lembretes de skill)

Hooks são lembretes não-bloqueantes injetados pelo Claude Code em momentos-chave. Existem dois tipos complementares:

- **Hooks `PreToolUse`** lembram **durante a edição**: editar endpoint lembra de `/security-checklist`, editar migration lembra de `/sql-templates`, etc.
- **Hook `Stop`** (v1.3.0+) lembra **no fim da sessão**, fechando o loop: chama `/pr-template` e `/security-checklist` antes de abrir o PR, evitando esquecer de rodar as skills de fechamento.

A partir da v1.2.0 os scripts são Node.js (`.mjs`) e funcionam em Linux, macOS e Windows nativo sem dependências externas.

```bash
claudiao hooks install                         # seleção interativa dos 5 hooks bundled
claudiao hooks install --only security,pr      # instala apenas os categorias informadas
claudiao hooks list                            # mostra hooks ativos
claudiao hooks uninstall                       # remove apenas os hooks do claudião, preserva outros
claudiao hooks uninstall --only pr             # remove apenas uma categoria
```

Os hooks editam `~/.claude/settings.json` fazendo merge (não overwrite) — hooks de outros plugins ficam intactos. Scripts ficam em `~/.claude/hooks/claudiao-*.mjs` e podem ser editados pra customizar as mensagens.

### Statusline de contexto (v1.5.0+)

Barra no rodapé do Claude Code com informação em tempo real da sessão: diretório, branch do git, modelo em uso, porcentagem de contexto consumida (verde <60%, amarelo 60-85%, vermelho >85%) e custo acumulado em USD.

```
📁 claudiao │ feat/v1.5.0-statusline │ Opus 4.7 (1M context) │ ██░░░░░░░░ 17% │ $11.46
```

Por que: quem usa Opus com 1M de contexto precisa saber quando a conversa tá chegando no limite — o claudião calcula baseado no campo `context_window.used_percentage` que o Claude Code envia.

```bash
claudiao statusline install           # instala (pergunta se já houver statusLine de outra origem)
claudiao statusline install --force   # substitui sem perguntar
claudiao statusline list              # mostra o que está configurado
claudiao statusline uninstall         # remove só se foi o claudião que instalou
```

O script vive em `~/.claude/statusline/context-bar.mjs` (cópia do template bundled, igual aos hooks). Pode ser editado pra customizar o formato. `claudiao statusline uninstall` preserva statusLines de outras origens — só remove se detectar que o path pertence ao claudião.

| Hook | Evento | Matcher | Quando lembra |
|------|--------|---------|---------------|
| `security` | `PreToolUse` | `Write\|Edit` em paths com `controller`, `route`, `handler`, `/api/`, `/auth/` | `/security-checklist` antes de declarar endpoint pronto |
| `ui` | `PreToolUse` | `Write\|Edit` em `.tsx/.jsx/.vue/.svelte` ou `components/pages/views` | `/ui-review-checklist` antes de abrir PR |
| `migration` | `PreToolUse` | `Write\|Edit` em `migrations/`, `*.sql`, `alembic/versions`, `prisma/migrations` | Patterns zero-downtime de `/sql-templates` |
| `commit` | `PreToolUse` | `Bash` com `git commit -m "..."` | Valida formato conventional commits |
| `pr` | `Stop` | (sem matcher) | `/pr-template` + `/security-checklist` no fim de sessão com edits — fecha o loop do fluxo |

**Por que o Stop hook existe:** a validação de 18/04/2026 mostrou que os hooks `PreToolUse` cobrem bem a fase de edição, mas o fechamento (rodar `/pr-template` e `/security-checklist` completo antes do PR) continuava sendo esquecido. O hook `pr` detecta sessões que tiveram edits (via `tool_use_count`, `has_edits` ou parsing do `transcript_path`) e injeta o lembrete; sessões só-leitura passam em silêncio.

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

## Relação com outros plugins do Claude Code

O claudião gerencia agents, skills, hooks e CLAUDE.md global dentro de `~/.claude/`. Esse diretório pode conter itens instalados por **outras fontes** — é importante entender o que o claudião gerencia e o que não.

**Fontes que convivem em `~/.claude/`**:

- **Plugins do Claude Code** (instalados via `claude /plugin install <nome>`) — ex: `superpowers`, `get-shit-done` (GSD), `claude-mem`. Esses plugins podem adicionar agents, hooks e skills em `~/.claude/` independente do claudião, com ciclo de vida próprio.
- **Customizações manuais** do usuário — arquivos `.md` criados direto em `~/.claude/agents/` ou similar.
- **Repo externo** configurado via `.claudiao.json` com `repoPath`.
- **Core do claudião** — os 18 agents, 9 skills, 5 hooks e CLAUDE.md global bundled no pacote.

**O que o claudião gerencia:** apenas os itens instalados pelo próprio claudião. São identificáveis por serem symlinks pros templates do pacote ou do repo externo configurado. A coluna `source` em `claudiao list agents/skills` (`[core|external|local]`) ajuda a distinguir.

**O que o claudião NÃO gerencia:**

- Agents e hooks instalados por plugins como `superpowers` ou `get-shit-done` — esses seguem o ciclo de vida do plugin. Use `claude /plugin` pra gerenciá-los.
- Arquivos criados manualmente pelo usuário em `~/.claude/`.

Se `claudiao doctor` reporta warnings em agents cujos nomes começam com `gsd-` ou similar, eles provavelmente vêm de um plugin instalado separadamente (não do claudião). Rode `claude /plugin list` pra ver plugins ativos do Claude Code.

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

## Troubleshooting

Se algum comando parece falhar sem dar detalhes (ex: `claudiao update` não linka nada novo, `claudiao init` pula um agente silenciosamente), rode com o flag `--verbose` pra ver decisões internas:

```bash
claudiao --verbose update          # decisões de path, symlinks, git pull
claudiao -v doctor                 # checagens detalhadas
CLAUDIAO_DEBUG=1 claudiao list     # via env var (útil em CI)
```

Saída em modo verbose (stderr, prefixo `[debug]`):

```
[debug] verbose mode ON (flag: --verbose)
[debug] getExternalRepoPath: ignored unreadable /home/user/.claude/.claudiao.json (Unexpected end of JSON input)
[debug] git pull error: fatal: not a git repository
```

O env var `CLAUDIAO_DEBUG=1` tem o mesmo efeito e sempre vence sobre `--verbose=false`, útil pra forçar logs em scripts CI sem mexer na invocação.

Se o problema não aparece no verbose, rode `claudiao doctor` — ele valida instalação, symlinks quebrados e frontmatter de agents/skills.

## Fluxo completo: do zero ao uso

```bash
# 1. Instala a CLI
npm install -g claudiao

# 2. Setup (agentes + skills + CLAUDE.md global)
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

## Cloud Specialists + CLI direto

O toolkit inclui um **[guia completo de integração com CLIs de cloud](./templates/CLOUD-CLI-GUIDE.md)** — o caso de uso mais poderoso dos agents. Com a CLI da AWS, GCP ou Azure autenticada, o Claude Code investiga erros, valida arquitetura, analisa logs e custos, tudo via conversa natural:

```
você: "o ECS task tá reiniciando, investiga"
       → aws-specialist roda describe-tasks, tail de logs, métricas de memória
       → diagnóstico: "OOM kill — container com 480MB de 512MB de limit"
       → sugestão: "aumente memoryReservation pra 1024"
```

O guia cobre: setup de autenticação (SSO, OAuth), permissões recomendadas, 10+ cenários reais com exemplos, MCP servers, e checklist de segurança.

## Guia de best practices

O projeto inclui um **[guia completo de best practices](./templates/CLAUDE-CODE-BEST-PRACTICES.md)** com:

- Workflows reais (feature nova, bug fix, code review, onboarding, deploy)
- Como combinar agentes + skills + hooks num fluxo completo
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

Plugins do Claude Code (se tiver instalado algum via `claude /plugin install`) são removidos com o comando nativo:

```bash
claude /plugin remove <nome-do-plugin>
```

## Licença

MIT
