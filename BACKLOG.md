# Backlog — claudião

> Documento vivo de features, melhorias e debt para futuras versões.
> Prioridade: **P0** (próxima release) → **P1** (curto prazo) → **P2** (médio prazo) → **P3** (longo prazo / nice-to-have)

---

## P0 — Bugs e correções urgentes

### BUG-001: Version hardcoded no config
**Onde:** `src/commands/init.ts:237`
**Problema:** A versão salva em `.claudiao.json` usa fallback `'1.0.0'` hardcoded em vez de ler do `package.json` do claudião instalado.
**Impacto:** Config sempre mostra `1.0.0` mesmo após atualização do pacote.
**Solução:** Importar a versão do `package.json` (já feito no `index.ts` com `readFileSync`) e reutilizar.

### BUG-002: Symlinks absolutos quebram ao mover instalação
**Onde:** `src/lib/symlinks.ts:42-43`
**Problema:** `symlinkSync(source, target)` cria symlinks com path absoluto. Se o user move o pacote ou muda o `nvm`/`volta`, todos os symlinks quebram.
**Impacto:** Baixo (o `doctor` já detecta), mas causa confusão em quem usa version managers.
**Solução:** Calcular path relativo com `path.relative()` antes de criar o symlink.

---

## P1 — Melhorias de curto prazo

### FEAT-001: Comando `uninstall`
**Descrição:** Remover tudo que o claudião instalou (symlinks, CLAUDE.md, config) com um comando.
**Motivação:** O README já documenta a remoção manual — é o gap mais visível da UX.
**Escopo:**
- Remove todos os symlinks em `~/.claude/agents/` que apontam para templates do claudião
- Remove todos os symlinks em `~/.claude/skills/` idem
- Remove `~/.claude/CLAUDE.md` se for symlink do claudião
- Remove `~/.claude/.claudiao.json`
- Não remove arquivos que o user criou manualmente (apenas symlinks do claudião)
- Suporte a `--dry-run`
- Confirmação interativa antes de executar

### FEAT-002: Lint e formatação (ESLint + Prettier ou Biome)
**Descrição:** Configurar linter e formatter no projeto.
**Motivação:** Zero configuração de lint atualmente. Com contribuições externas, o estilo vai divergir.
**Escopo:**
- Escolher entre ESLint + Prettier ou Biome (Biome é mais simples pra projetos novos)
- Script `npm run lint` e `npm run format`
- Adicionar ao CI (`ci.yml`)
- Rodar no pre-commit (opcional, via husky ou lefthook)

### FEAT-003: Testes para commands
**Descrição:** Adicionar testes unitários para `doctor`, `list`, `update` e `remove`.
**Motivação:** Só `lib/` tem testes. Os commands são a lógica de negócio principal e não estão cobertos.
**Escopo:**
- Mockar filesystem (`memfs` ou `mock-fs`) para não depender de `~/.claude/`
- Mockar `execSync` para testes de `doctor` e `install-plugin`
- Testar: `doctor` detecta problemas, `list` agrupa por categoria, `update` linka novos, `remove` limpa corretamente
- Meta: cobertura de 80%+ nos commands

### FEAT-004: Seleção granular no `init`
**Descrição:** Permitir selecionar quais agentes e skills instalar durante o `init`.
**Motivação:** Nem todo mundo quer 18 agentes. Um dev Python não precisa do `react-specialist`.
**Escopo:**
- Prompt checkbox com agentes agrupados por categoria
- Opção `--all` para instalar tudo sem perguntar (comportamento atual)
- Salvar seleção no `.claudiao.json` para o `update` respeitar

### FEAT-005: Comando `enable` / `disable` agente/skill
**Descrição:** Desativar temporariamente um agente ou skill sem removê-lo.
**Motivação:** Quem usa muitos agentes pode querer desativar alguns temporariamente para reduzir contexto.
**Escopo:**
- `claudiao disable agent aws-specialist` → remove symlink mas mantém registro de que foi desativado
- `claudiao enable agent aws-specialist` → recria symlink
- `claudiao list agents` mostra status (ativo/inativo)
- Persistir estado no `.claudiao.json`

### FEAT-021: Hooks do claudião (forçar skills em momentos críticos)
**Descrição:** Instalar hooks em `~/.claude/settings.json` que lembram o user
de invocar skills em momentos específicos — transformando skills de opt-in
em opt-out.
**Motivação:** Validação da lib mostrou que skills e agentes não auto-ativam
por contexto. Nada força `/security-checklist` antes de PR, nem
`/ui-review-checklist` após editar componente. Hooks resolvem sem exigir
disciplina do user.
**Escopo:**
- `claudiao hooks install` → adiciona hooks em `~/.claude/settings.json` (merge, não overwrite)
- `claudiao hooks uninstall` → remove apenas os hooks do claudião (identificados por comentário/marker)
- `claudiao hooks list` → mostra quais hooks estão ativos
- Templates de hook bundled em `templates/hooks/`:
  - **`pre-write-endpoint.sh`**: ao editar arquivo em `routes/`, `controllers/`, `handlers/`, exibe lembrete "rodou /security-checklist?"
  - **`pre-write-component.sh`**: ao editar `.tsx`/`.jsx`, lembra `/ui-review-checklist`
  - **`pre-migration.sh`**: ao criar arquivo em `migrations/`, lembra `/sql-templates` (expand-contract)
  - **`post-commit.sh`**: valida se conventional commit foi respeitado
- Opt-in por tipo: `claudiao hooks install --only security,ui` (lista de categorias)
- Documentar override: user pode editar `~/.claude/hooks/claudiao-*.sh` pra customizar
**Dependências:** nenhuma — hooks do Claude Code já suportam matchers por tool name.

### FEAT-022: Validação de frontmatter em `claudiao doctor`
**Descrição:** O `doctor` hoje checa symlinks e paths, mas não valida se o
frontmatter dos agents/skills está completo.
**Motivação:** Agentes com frontmatter incompleto (falta `description` clara,
falta `model`) funcionam, mas deixam triggers inconsistentes. Validação
proativa evita falha silenciosa na ativação.
**Escopo:**
- `doctor` roda gray-matter em todo agent/skill instalado
- Valida: `name`, `description` (>50 chars), `model`, `tools`/`allowed-tools`
- Warn se descrição não tem trigger explícito ("when user says", "use when")
- Flag `--fix` sugere correções

---

## P2 — Melhorias de médio prazo

### FEAT-006: Plugin registry dinâmico
**Descrição:** Mover o registry de plugins do código para um JSON externo (local ou remoto).
**Motivação:** Adicionar plugins requer alterar código e publicar nova versão. Com registry externo, novos plugins ficam disponíveis sem atualizar o pacote.
**Escopo:**
- `plugins-registry.json` no repositório (ou fetch de URL)
- `claudiao list plugins --refresh` para atualizar cache local
- Manter fallback para registry bundled (offline-first)
- Contribuições de plugins via PR no registry

### FEAT-007: Importar agente/skill de URL ou gist
**Descrição:** Instalar um agente ou skill a partir de uma URL (GitHub raw, gist, etc).
**Motivação:** Facilitar compartilhamento ad-hoc sem precisar de repo externo.
**Escopo:**
- `claudiao install agent https://gist.github.com/.../go-specialist.md`
- `claudiao install skill https://github.com/.../tree/main/skills/deploy-checklist`
- Download para `~/.claude/agents/` ou `~/.claude/skills/` + symlink
- Validar frontmatter antes de instalar
- Registrar origem no `.claudiao.json` para updates futuros

### FEAT-008: Versionamento de agentes/skills
**Descrição:** Permitir rastrear a versão dos agentes/skills instalados.
**Motivação:** Quando o user roda `update`, não sabe o que mudou. Com versionamento, pode ver changelog.
**Escopo:**
- Adicionar campo `version` no frontmatter dos agentes/skills
- `claudiao list agents --verbose` mostra versão
- `claudiao update` mostra diff do que mudou (antes/depois)
- Considerar hash do conteúdo como fallback se não tiver versão

### FEAT-009: Agentes por projeto (escopo local)
**Descrição:** Suportar agentes/skills no nível do projeto (`.claude/agents/` do projeto) além do global.
**Motivação:** Projetos diferentes podem precisar de agentes diferentes. Um monorepo pode ter agentes específicos para cada módulo.
**Escopo:**
- `claudiao init --project` → instala em `.claude/` do projeto atual (não o global)
- `claudiao create agent --project` → salva no projeto
- `claudiao list agents` mostra global + local com indicador de escopo
- Respeitar `.gitignore` (agentes do projeto devem ser commitados?)

### FEAT-010: Autocompletion no shell
**Descrição:** Tab completion para bash, zsh e fish.
**Motivação:** UX padrão de CLIs profissionais. Commander.js não gera automaticamente.
**Escopo:**
- `claudiao completion` gera script de completion
- `claudiao completion --install` adiciona ao `.bashrc` / `.zshrc`
- Completar: subcomandos, nomes de agentes instalados, nomes de skills, nomes de plugins
- Usar lib como `omelette` ou gerar manualmente

### FEAT-011: Output em JSON (`--json`)
**Descrição:** Flag `--json` nos comandos `list`, `doctor` e `update` para output estruturado.
**Motivação:** Permite integração com scripts, CI pipelines e ferramentas de automação.
**Escopo:**
- `claudiao list agents --json` → array de `{ name, description, category, status }`
- `claudiao doctor --json` → `{ checks: [...], issues: number, ok: boolean }`
- `claudiao update --json` → `{ new: [...], relinked: [...], orphans: [...] }`
- Sem cores/formatação quando `--json` ativo

### FEAT-012: Comando `diff` para comparar com upstream
**Descrição:** Mostrar diferenças entre agente/skill instalado e a versão no source.
**Motivação:** Quem editou um agente localmente quer saber se o upstream mudou antes de atualizar.
**Escopo:**
- `claudiao diff agent aws-specialist` → diff entre `~/.claude/agents/aws-specialist.md` e source
- `claudiao diff --all` → lista todos os que divergem
- Integrar com `update --force` para mostrar o que seria sobrescrito

---

## P3 — Longo prazo / nice-to-have

### FEAT-013: Marketplace de agentes/skills
**Descrição:** Repositório central onde a comunidade publica e descobre agentes/skills.
**Motivação:** Hoje compartilhamento é manual (copiar .md). Um marketplace reduz fricção.
**Escopo:**
- Repositório GitHub com diretório de agentes/skills (como awesome-lists)
- `claudiao search agent "kubernetes"` → busca no índice
- `claudiao install agent community/k8s-specialist` → instala do marketplace
- Sistema de rating/download count
- CI que valida frontmatter dos PRs

### FEAT-014: Testes end-to-end da CLI
**Descrição:** E2E tests que rodam a CLI real contra um diretório temporário.
**Motivação:** Testes unitários não cobrem integração entre commands e filesystem real.
**Escopo:**
- Criar tmpdir, setar `HOME` para tmpdir, rodar `claudiao init`, validar resultado
- Testar fluxo completo: init → list → create → remove → doctor
- Rodar no CI (já tem matrix de Node versions)
- Usar `execa` ou `child_process` para invocar a CLI compilada

### FEAT-015: Hooks pre/post install
**Descrição:** Executar scripts customizados antes/depois de instalar agentes/skills.
**Motivação:** Times podem querer validar, transformar ou notificar quando agentes mudam.
**Escopo:**
- Config em `.claudiao.json`: `{ hooks: { preInstall: "script.sh", postInstall: "script.sh" } }`
- Hooks recebem nome e path do agente/skill como args
- Exemplo: hook que posta no Slack quando alguém atualiza os agentes do time

### FEAT-016: Profiles (conjuntos de agentes)
**Descrição:** Criar profiles nomeados com diferentes conjuntos de agentes/skills ativados.
**Motivação:** O mesmo dev pode querer um set "backend" durante a semana e "fullstack" em projetos pessoais.
**Escopo:**
- `claudiao profile create backend` → wizard para selecionar agentes/skills
- `claudiao profile use backend` → ativa apenas os agentes/skills do profile
- `claudiao profile list` → mostra profiles disponíveis
- Persistir em `.claudiao.json`

### FEAT-017: Sync com repo Git automático
**Descrição:** Observar mudanças no repo externo e re-linkar automaticamente.
**Motivação:** Hoje o user precisa rodar `claudiao update` manualmente.
**Escopo:**
- `claudiao watch` → roda em background, faz polling ou usa `fs.watch`
- Alternativa: cron job ou hook de `git pull`
- Notifica no terminal quando agentes/skills mudaram

### FEAT-018: Template engine para agentes
**Descrição:** Suportar variáveis/placeholders nos templates de agentes.
**Motivação:** Agentes poderiam ser parametrizados (ex: `{{project_language}}`, `{{team_conventions}}`).
**Escopo:**
- Sintaxe `{{ variable }}` nos templates .md
- `claudiao init` pergunta valores das variáveis
- Renderiza e salva versão resolvida
- Variáveis padrão: `project_name`, `language`, `framework`

### FEAT-019: Migração de versão
**Descrição:** Script de migração quando a estrutura do `.claudiao.json` ou dos agentes mudar entre versões.
**Motivação:** À medida que o projeto evolui, o formato do config e frontmatter pode mudar.
**Escopo:**
- `claudiao migrate` → detecta versão atual e aplica migrações incrementais
- Manter array de migrations versionadas
- Rodar automaticamente no `init` e `update`

### FEAT-020: Métricas de uso dos agentes
**Descrição:** Rastrear quais agentes/skills são mais usados para informar priorização.
**Motivação:** Saber se os 18 agentes estão sendo usados ou se 3 concentram 90% do uso.
**Escopo:**
- Hook que conta invocações (arquivo local, nunca telemetria remota)
- `claudiao stats` → mostra ranking de uso
- Opt-in explícito
- Dados ficam em `~/.claude/.claudiao-stats.json`

---

## Tech debt

### DEBT-001: Catch blocks silenciosos
**Onde:** `paths.ts:48`, `init.ts:93`, `list.ts:36`, `doctor.ts:19`
**Problema:** `catch { }` sem nenhum log dificulta debug quando algo dá errado silenciosamente.
**Solução:** Adicionar `// expected: corrupt config` ou log em modo verbose.

### DEBT-002: `console.log` espalhado nos commands
**Onde:** Todos os commands usam mix de `console.log()` direto e funções de `format.ts`.
**Problema:** Inconsistência no output. Dificulta futura implementação de `--json` e `--quiet`.
**Solução:** Rotear todo output por `format.ts`. Adicionar `output.write()` que respeita flags globais.

### DEBT-003: Duplicação de lógica dry-run
**Onde:** `init.ts`, `update.ts`, `remove.ts`
**Problema:** Cada command reimplementa a lógica de dry-run com if/else. Muito boilerplate.
**Solução:** Criar wrapper `dryRunnable(action, dryMessage)` ou middleware no Commander.

### DEBT-004: Sem validação do frontmatter ao instalar
**Onde:** `init.ts:107-122`, `update.ts:51-72`
**Problema:** Se um agente tem frontmatter inválido, o `init` faz catch silencioso e instala mesmo assim. Pode instalar um .md quebrado.
**Solução:** Validar campos obrigatórios (`name`, `description`) e emitir warning se faltar.

### DEBT-005: `install-plugin` sem validação de command injection
**Onde:** `src/commands/install-plugin.ts` → `execSync(plugin.installCommand)`
**Problema:** Seguro hoje (registry hardcoded), mas se o registry virar dinâmico (FEAT-006), é injection direto.
**Solução:** Sanitizar ou usar `spawn` com array de args em vez de `execSync` com string.

### DEBT-006: Sem modo verbose/debug
**Onde:** Global
**Problema:** Quando algo dá errado, não tem como ver detalhes. O `doctor` ajuda, mas não cobre runtime.
**Solução:** Flag `--verbose` ou env var `CLAUDIAO_DEBUG=1` que ativa logs detalhados em todos os commands.

---

## Notas

- Prioridades podem mudar com feedback dos usuários
- Features de P2/P3 devem ser validadas com issue no GitHub antes de implementar
- Toda feature nova deve incluir testes e documentação no README
- Manter compatibilidade com Node.js 18+ (LTS)
