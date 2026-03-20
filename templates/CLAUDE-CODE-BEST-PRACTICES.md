# Guia Prático — Claude Code no Dia a Dia

Como usar o Claude Code de forma eficiente em projetos reais. Inclui cenários do dia a dia, integração com plugins da comunidade, e os agentes/skills deste toolkit.

---

## 1. Mentalidade: Direção > Velocidade

O Claude Code é um **dev júnior muito rápido que precisa de boa direção**. Quanto mais contexto você der, melhor o resultado.

### Prompt ruim vs bom

```
# Ruim — vago, sem contexto
> faz uma tela de login

# Bom — específico, com referências
> Crie uma tela de login em /src/pages/Login.tsx com:
> - Campos: email e senha com validação Zod
> - Use o componente Button de @src/components/ui/Button.tsx
> - Integre com o hook useAuth de @src/hooks/useAuth.ts
> - Siga o pattern do form em @src/pages/Register.tsx
> - Testes com Vitest + Testing Library
```

**Regra**: Se você gastaria 2 minutos explicando pra um dev júnior, gaste 30 segundos escrevendo no prompt.

---

## 2. CLAUDE.md: Memória Persistente do Projeto

Sem CLAUDE.md, toda sessão começa do zero. Com ele, o Claude já sabe sua stack, padrões e regras.

### Hierarquia (o mais específico ganha)

```
~/.claude/CLAUDE.md              → Global (todos os projetos) ← este toolkit instala aqui
~/projeto/CLAUDE.md              → Projeto (commitado no git)
~/projeto/.claude/local.md       → Pessoal (gitignored)
~/projeto/src/api/CLAUDE.md      → Subdiretório (mais específico)
```

### Gere automaticamente na primeira vez

```bash
cd seu-projeto
claude
> /init
```

O Claude analisa o projeto e gera um CLAUDE.md inicial. Depois você refina.

### O que incluir

```markdown
# Projeto XYZ

## Stack
- Backend: Node.js + NestJS + TypeScript + Prisma
- Frontend: React + Next.js + Tailwind
- Banco: PostgreSQL
- Testes: Vitest + Testing Library + Playwright

## Comandos
- Dev: `npm run dev`
- Build: `npm run build`
- Testes: `npm test`
- Lint: `npm run lint`

## Padrões
- TypeScript strict, sem `any`
- Imports com alias @/ para src/
- Conventional commits em inglês
- Testes ao lado do arquivo: arquivo.test.ts

## Regras importantes
- NUNCA faça commit sem rodar testes
- SEMPRE valide inputs com Zod nos DTOs
- Usar Prisma, não queries raw
```

---

## 3. Workflow: Do Início ao Commit

### Cenário: Implementar feature nova

```bash
# 1. Sessão limpa
> /clear

# 2. Refine a ideia (invoca idea-refiner automaticamente)
> Preciso adicionar sistema de notificações por email e push.
> Qual o MVP mínimo? Quais perguntas preciso responder antes?

# 3. Planeje a implementação (invoca implementation-planner)
> Ok, vamos com email primeiro. Quebre em tasks executáveis.

# 4. Valide a arquitetura se necessário (invoca architect)
> Think hard sobre: devo usar fila (BullMQ) ou processar inline?

# 5. Implemente task por task
> Implemente a Task 1: criar o módulo de notificações com NestJS.

# 6. Teste
> Rode os testes e corrija falhas.

# 7. Review de segurança (invoca security-specialist via subagent)
> Use um subagent pra fazer review de segurança das mudanças.

# 8. Review de código (invoca pr-reviewer via subagent)
> Use um subagent pra fazer code review das mudanças.

# 9. Commit
> /commit
```

### Cenário: Fix de bug em produção

```bash
> /clear

# Descreva o sintoma com dados
> Bug: endpoint POST /api/orders retorna 500 intermitente.
> Acontece em 1 a cada ~100 requests. Logs mostram:
> "PrismaClientKnownRequestError: Unique constraint failed on the fields: (order_number)"
> Ultrathink sobre a causa raiz e como corrigir.

# Após o fix
> /security-checklist    # Valida que o fix não abriu brechas
> /commit
```

### Cenário: Code review de PR

```bash
> /clear

# Cole o link da PR ou peça pra analisar o diff
> Faz review da PR #42 no repo empresa/backend.
> Foque em: segurança, performance, e aderência aos padrões do projeto.

# Ou review de arquivos específicos
> Review dos arquivos que mudei: @src/modules/auth/auth.service.ts
> e @src/modules/auth/auth.guard.ts
```

### Cenário: Onboarding em projeto novo

```bash
> /clear

# Use subagents pra mapear tudo em paralelo
> Use subagents pra mapear este projeto:
>
> 1. Arquitetura: estrutura de pastas, dependências, patterns
> 2. Padrões de código: naming, tratamento de erros, tipagem
> 3. Testes: framework, cobertura, como rodar
>
> Me traga um resumo consolidado.

# Depois gere o CLAUDE.md
> /init
```

### Cenário: Preparar deploy

```bash
> /clear

> /security-checklist    # Roda o checklist de segurança completo

# Peça auditoria de dependências
> Rode npm audit e analise as vulnerabilidades.
> Quais são críticas e como resolver?
```

---

## 4. Subagents: Pesquisa sem Poluir Contexto

Subagents rodam em **contexto isolado**. Seu contexto principal fica limpo pra implementação.

### Quando usar vs não usar

| Situação | Subagent? | Por quê |
|----------|-----------|---------|
| Investigar como algo funciona | Sim | Muita leitura de arquivo |
| Implementar feature simples | Não | Execução direta é mais rápida |
| Code review após mudanças | Sim | Mantém contexto limpo |
| Bug complexo multi-arquivo | Sim | Múltiplas áreas pra investigar |
| Editar um único arquivo | Não | Overhead desnecessário |
| Rodar testes e reportar | Sim | Output de testes é verboso |

### Exemplos práticos

```bash
# Investigação paralela (3 subagents ao mesmo tempo)
> Preciso otimizar performance do módulo de pedidos.
> Use subagents em paralelo:
> 1. Analise queries do banco em /src/modules/orders/
> 2. Verifique bundle size dos componentes de /src/components/orders/
> 3. Analise latência dos endpoints de pedidos nos logs
> Sintetize num plano de ação priorizado.

# Code review via subagent
> Use um subagent pra fazer code review das mudanças que implementei.
> Foque em segurança, performance e tipagem.

# Explorar documentação
> Use um subagent pra ler a doc do Prisma sobre migrations
> e me trazer os patterns relevantes pro nosso caso.
```

### Subagents em background (Ctrl+B)

Mande um subagent pro background e continue trabalhando:

```bash
> [inicia tarefa pesada com subagent]
> [aperte Ctrl+B pra mandar pro background]
> [continue trabalhando em outra coisa]
> [resultado aparece quando terminar]
```

---

## 5. Níveis de Raciocínio

O Claude Code aloca mais tokens de raciocínio com keywords específicas. Funciona **apenas no Claude Code CLI**.

| Nível | Tokens | Keywords | Quando usar |
|-------|--------|----------|-------------|
| Normal | 0 | — | Renomear variável, fix typo, adicionar campo |
| think | 4K | `think` | Refatorar função, adicionar error handling |
| megathink | 10K | `think hard`, `megathink` | Arquitetura de serviço, estratégia de caching |
| ultrathink | 32K | `think harder`, `ultrathink` | Bug intermitente, redesign de sistema, security audit |

### Exemplos por nível

```bash
# Normal — tarefa simples
> Adicione um campo "telefone" no schema de usuário

# think — precisa de alguma análise
> Esse teste tá falhando. Think sobre o que pode estar causando.

# megathink — decisão técnica
> Think hard sobre como implementar caching nessa API.
> Redis com TTL ou cache in-memory? Quais endpoints se beneficiam?

# ultrathink — problema complexo
> Estamos vendo race conditions no processamento de pagamentos.
> Acontece em 1 a cada 100 transações.
> Ultrathink sobre as possíveis causas e soluções.
```

### Combo: ultrathink + subagents

```bash
# O mais poderoso: raciocínio profundo + pesquisa paralela
> Ultrathink sobre como resolver esse problema de performance.
> Use subagents pra investigar em paralelo:
> 1. Queries do banco com EXPLAIN ANALYZE
> 2. Bundle size do frontend
> 3. Logs de latência da API
> Sintetize num plano priorizado.
```

**Regra**: Escale conforme a complexidade. Não use ultrathink em tudo — over-thinking é real e gasta tokens sem benefício.

---

## 6. Agentes Deste Toolkit na Prática

Os 18 agentes são invocados **automaticamente** pelo Claude Code quando detecta que a tarefa casa com a especialidade.

### Cenários reais → agente ativado

```bash
# Dev
> "Cria um endpoint de CRUD pra produtos"           → nodejs-specialist
> "Esse componente tá renderizando demais"           → react-specialist
> "Query tá lenta, como otimizar?"                   → database-specialist

# Cloud (ver guia completo: CLOUD-CLI-GUIDE.md)
> "Preciso deployar isso na AWS com Fargate"         → aws-specialist
> "Configura um App Service na Azure"                → azure-specialist
> "Melhor opção de hosting no GCP pra isso?"         → gcp-specialist
> "O ECS task tá reiniciando, investiga"             → aws-specialist (usa CLI direto)
> "Busca erros no Cloud Run nas últimas 2h"          → gcp-specialist (usa CLI direto)

# Qualidade
> "Faz review dessa PR"                              → pr-reviewer
> "Analisa a segurança desse módulo"                 → security-specialist
> "Preciso de testes pra esse serviço"               → test-specialist

# Planejamento
> "Qual a melhor arquitetura pra isso?"              → architect
> "Tenho uma ideia, me ajuda a refinar"              → idea-refiner
> "Quebra essa feature em tasks"                     → implementation-planner
```

### Skills (slash commands manuais)

```bash
> /pr-template                 # Template de PR padronizado
> /security-checklist          # Checklist pré-deploy
> /architecture-decision       # Template de ADR
> /meet-dod                    # Reunião → Definition of Done
> /sql-templates               # Templates SQL pra diagnóstico
> /ui-review-checklist         # 30+ items de review de UI
```

---

## 7. Plugins da Comunidade: Quando Usar Cada Um

Instale com `claudiao install plugin <nome>`.

### superpowers — Metodologia de desenvolvimento

Complementa os agentes com **workflow de TDD e debugging**.

```bash
# TDD enforced — ele recusa implementar sem teste primeiro
> Implemente o serviço de notificações com TDD.
# superpowers força: escreva teste RED → implemente GREEN → REFACTOR

# Debugging sistemático em 4 fases
> Tenho um bug: [descrição]
# superpowers segue: Reproduce → Isolate → Fix → Verify

# Git worktrees — branches isoladas
> Preciso trabalhar nessa feature sem afetar main.
# superpowers cria worktree isolado automaticamente
```

**Quando usar**: Sempre que quiser disciplina de TDD ou debugging estruturado. Funciona junto com `test-specialist` e `pr-reviewer`.

### get-shit-done — Planejamento estruturado

Complementa `implementation-planner` e `idea-refiner` com **persistência de estado**.

```bash
# Projeto novo do zero
> /gsd:new-project
# Faz perguntas → pesquisa → gera REQUIREMENTS.md + ROADMAP.md

# Mapear projeto existente (brownfield)
> /gsd:map-codebase
# Analisa o projeto e gera documentação da arquitetura

# Ciclo completo de feature
> /gsd:discuss-phase    # Captura decisões
> /gsd:plan-phase       # Pesquisa + planejamento
> /gsd:execute-phase    # Executa em waves paralelas com commits atômicos
> /gsd:verify-work      # Testes de aceitação
```

**Quando usar**: Projetos longos que precisam de estado persistido entre sessões. Mantém PROJECT.md, REQUIREMENTS.md, ROADMAP.md e STATE.md atualizados.

### claude-mem — Memória entre sessões

Resolve o problema de **perder contexto quando fecha o terminal**.

```bash
# Buscar memórias de sessões anteriores
> /mem-search "como configuramos o auth?"
# Retorna decisões e contexto de sessões passadas

# Funciona automaticamente via hooks — captura:
# - Decisões de arquitetura tomadas
# - Bugs resolvidos e a causa raiz
# - Padrões descobertos no código
# - Comandos que funcionaram
```

**Quando usar**: Projetos longos onde você toma muitas decisões técnicas ao longo de semanas. Especialmente útil se trabalha em múltiplos projetos e precisa retomar contexto.

### Como os 3 trabalham juntos

```
Sessão 1 (segunda-feira):
├── /gsd:new-project         → Cria roadmap do projeto
├── implementation-planner   → Quebra milestone 1 em tasks
├── architect                → Decide arquitetura (ADR)
└── claude-mem               → Salva tudo automaticamente

Sessão 2 (terça-feira):
├── /mem-search "decisões"   → Recupera contexto da sessão 1
├── /gsd:execute-phase       → Implementa tasks com TDD (superpowers)
├── test-specialist          → Estratégia de testes
├── pr-reviewer              → Review antes do merge
└── /security-checklist      → Valida segurança pré-merge

Sessão 3 (quarta-feira):
├── /gsd:verify-work         → Testes de aceitação
├── /gsd:complete-milestone  → Arquiva e tageia release
└── claude-mem               → Contexto completo preservado
```

---

## 8. Dicas Práticas

### /clear entre tarefas

```bash
> /clear    # SEMPRE antes de mudar de assunto
```

O contexto acumulado de uma tarefa **atrapalha** a próxima. 1 tarefa = 1 sessão limpa.

### Referencie arquivos com @

```bash
# Ruim — Claude precisa procurar
> Refatore o serviço de auth

# Bom — Claude sabe exatamente onde ir
> Refatore @src/modules/auth/auth.service.ts
> seguindo o pattern de @src/modules/users/users.service.ts
```

### Imagens como contexto

```bash
# Arraste screenshot do Figma pro terminal
> Implemente esse layout usando os componentes de @src/components/ui/

# Iteração visual (2-3 rounds = pixel-perfect)
> [screenshot do resultado]
> Compare com o design original e ajuste as diferenças
```

### Sessões paralelas

```bash
# Terminal 1: Backend
cd src/modules/orders && claude

# Terminal 2: Frontend
cd src/components/orders && claude

# Terminal 3: Testes
cd tests && claude
```

Cada instância tem contexto independente.

### Checkpoints = safety net

```bash
> /undo    # Desfaz a última mudança do Claude
```

Nunca tenha medo de deixar o Claude tentar algo. `/undo` sempre te salva.

---

## 9. Hooks: Qualidade Automática

Configure em `~/.claude/hooks.json` pra rodar lint/typecheck automaticamente após cada edição:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "npm run lint --fix 2>/dev/null; npm run typecheck 2>/dev/null"
      }
    ]
  }
}
```

---

## 10. Atalhos de Teclado

| Atalho | O que faz |
|--------|-----------|
| `Shift+Tab` (2x) | Plan Mode — planeja sem editar |
| `Ctrl+C` | Cancela geração atual |
| `Ctrl+B` | Manda subagent pro background |
| `Seta cima` | Navega histórico de prompts |
| `/clear` | Limpa contexto |
| `/undo` | Desfaz última mudança |
| `/compact` | Compacta contexto (resume histórico) |
| `Esc` | Cancela input |

---

## Resumo: Regras de Ouro

| Regra | Por quê |
|-------|---------|
| CLAUDE.md em todo projeto | Contexto persistente = respostas melhores |
| Plan Mode antes de codar | Evita refatoração desnecessária |
| Subagents pra pesquisa | Mantém contexto principal limpo |
| Ultrathink pra problemas difíceis | 8x mais raciocínio quando precisa |
| /clear entre tarefas | Contexto limpo = menos confusão |
| @ pra referenciar arquivos | Menos tokens gastos procurando |
| Itere, não espere perfeição | 2-3 iterações > 1 prompt perfeito |
| /undo te salva | Deixe o Claude tentar, desfaça se errar |
| 1 tarefa = 1 sessão | Foco > multitask |
