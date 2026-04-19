# Backlog — claudião

> Documento vivo de features, melhorias e debt para futuras versões.
> Prioridade: **P0** (próxima release) → **P1** (curto prazo) → **P2** (médio prazo) → **P3** (longo prazo / nice-to-have)

---

## ✅ Resolvido em 1.3.0

> Entregue na branch `feat/v1.3.0-stop-hook-techdebt`. Foco em fechamento de loop (Stop hook) e consolidação de tech debt.

- **Fechamento do loop do fluxo**: novo Stop hook (`pr`) lembra `/pr-template` e `/security-checklist` ao finalizar sessão com edits. Detecta sessões só-leitura via `tool_use_count`, `has_edits` ou parsing de `transcript_path` e passa em silêncio. Complementa FEAT-021 (hooks `PreToolUse` de edição) fechando o gap identificado na validação de 18/04/2026.
- **DEBT-001 (catches silenciosos)**: cada catch legítimo ganhou comentário `// expected: <razão>` + `debug()` pra surfacar detalhe em modo verbose.
- **DEBT-002 (output descentralizado)**: todos os `console.log/error/warn` em commands agora passam por `lib/format.ts`. Respeitam `setQuiet` e `setJsonMode` — `--quiet` e `--json` viram flags triviais de adicionar no futuro.
- **DEBT-003 (duplicação de dry-run)**: helper `dryRunnable` em `lib/dry-run.ts`; `init`, `update` e `remove` agora usam esse wrapper em vez de if/else repetido.
- **DEBT-006 (sem modo verbose)**: flag global `--verbose`/`-v` e env var `CLAUDIAO_DEBUG=1` ativam `[debug]` logging via stderr. README ganhou seção "Troubleshooting" apontando pro fluxo novo.
- **Clarificação documental**: README ganhou seção "Relação com outros plugins do Claude Code" explicando que `superpowers`/`get-shit-done` são plugins separados (não bundled). BACKLOG registra que a feature de bundles foi adiada por falta de caso de uso concreto.

## ✅ Resolvido em 1.2.1

> Hotfix de 18/04/2026 — regressões identificadas logo após publicar a 1.2.0. Branch `fix/v1.2.1-doctor-hooks-regression`.

- **Regressão**: `claudiao doctor` reportava todos os symlinks válidos como quebrados porque `existsSync(readlinkSync(path))` resolve paths relativos contra `process.cwd()`. Checagem centralizada em `isSymlinkBroken` (`src/lib/symlinks.ts`).
- **Regressão**: `claudiao hooks install --only a,b` ignorava a primeira categoria. `mergeHooksIntoSettings` rodava a limpeza dentro do loop por categoria e apagava as entradas escritas na iteração anterior.
- **Regressão**: hook de migration usava matcher `Write` apenas; agora dispara em `Write|Edit`. Auto-migração silenciosa em `hooks install` via `migrateClaudiaoHookMatchers`.
- **Gap**: `claudiao hooks uninstall --only <categorias>` adicionado para paridade com `install`.

## ✅ Resolvido em 1.2.0

> Validados em sessão de 18/04/2026 e implementados na branch `feat/v1.2.0-bugs-bundles-hooks`. Commit range disponível via `git log v1.1.0..v1.2.0`.

- **BUG-001**: version sincronizada com `package.json` em `init` e `update` via helper `getPackageVersion` (`src/lib/package-info.ts`).
- **BUG-002**: symlinks criados em POSIX agora usam path relativo; absolutos existentes são auto-migrados na próxima `update`. Windows mantém absoluto por exigência de junctions.
- **DEBT-004**: `init`, `update` e `create` agora chamam `validateAgentFrontmatter`/`validateSkillFrontmatter` antes de linkar; erros pulam o item e retornam exit code 1.
- **FEAT-025**: `CHANGELOG.md` (Keep a Changelog) adicionado com entradas retroativas para 1.0.0, 1.1.0 e 1.2.0.
- **FEAT-028**: hooks bundled reescritos em Node.js (`.mjs`) — sem mais dependência de bash/grep/sed, cross-platform (Windows nativo, macOS, Linux). Migração automática de entradas `.sh` legadas em `settings.json` + cleanup dos arquivos `.sh` órfãos em `~/.claude/hooks/`.
- **DEBT-007**: hooks agora têm testes de integração via `spawnSync` (15 testes em `hook-scripts.integration.test.ts`).
- **Descoberta durante validação**: coluna `source` em `list agents/skills` (`[core|external|local]`) — distingue bundled, external repo e itens manuais.

## ✅ Resolvido em 1.1.0

- **FEAT-021**: sistema de hooks (`claudiao hooks install|uninstall|list`) implementado em `src/commands/hooks.ts` e `src/lib/hooks.ts` (commit `87da686`). Observação: os 4 scripts bundled são `.sh` hoje — rewrite cross-platform tracked em **FEAT-028** (Pré-1.2).
- **FEAT-022**: validação de frontmatter em `claudiao doctor` implementada em `src/lib/validate-frontmatter.ts` (commit `87da686`). Wiring nos demais comandos (DEBT-004) completado em 1.2.0.

---

## Pré-1.2 — Profissionalização (blockers de adoção externa)

> Diagnóstico de validação de abril/2026: código está sólido, conteúdo (agents/skills) está bom, **mas falta infraestrutura de projeto**. Sem os itens abaixo, a lib funciona como ferramenta pessoal mas não atinge adoção externa. Ordem sugerida: FEAT-023 → FEAT-025 → FEAT-026 → FEAT-027 → FEAT-024 → FEAT-028.

### FEAT-023: CI/CD pipeline com GitHub Actions
**Motivação:** Hoje não há CI. Qualquer PR externo é russa roleta, e você pode publicar release quebrada sem saber. É o item #1 pra qualquer contribuição externa.
**Escopo:**
- Workflow `.github/workflows/ci.yml` rodando em cada PR e push para main
- Jobs: `typecheck`, `test`, `build`, `lint` (requer FEAT-002 antes)
- Matrix de Node: 18, 20, 22
- Matrix de OS: `ubuntu-latest`, `macos-latest`, `windows-latest` (pega regressão cross-platform)
- Dependabot ou Renovate habilitado pra deps
- Badge no README com status do CI
**Estimativa:** 3-4h para setup básico; +2h pra matrix completa
**Dependência:** FEAT-002 (lint) precisa estar pronto ou ser feito junto

### FEAT-024: Release automation (changesets)
**Motivação:** Hoje release é manual (`npm run build` + `npm publish` + `git tag` + `git push`). Fácil esquecer uma etapa e publicar dist vazio, tag dessincronizada, ou versão errada.
**Escopo:**
- Adotar [changesets](https://github.com/changesets/changesets) ou `release-please`
- Workflow dispara release automático em push para main com changeset pendente
- Gera `CHANGELOG.md` automaticamente (integra com FEAT-025)
- Cria git tag + GitHub release + npm publish em um fluxo atômico
- Gate: testes passando é pré-requisito
- Documentação em CONTRIBUTING (FEAT-027) de como adicionar changeset em PRs
**Estimativa:** 3-4h
**Dependência:** FEAT-023 (CI) pronto

### FEAT-025: CHANGELOG.md versionado — ✅ resolvido em 1.2.0
_Concluído na branch `feat/v1.2.0-bugs-bundles-hooks`. Restante (automação via FEAT-024) ainda pendente._

### FEAT-026: README visual com demo
**Motivação:** README atual é só texto. Lib de CLI com 18 agents + 9 skills + hooks merece demonstração visual. Sem isso, usuário novo desiste antes de instalar.
**Escopo:**
- GIF/vídeo curto (≤30s) mostrando `claudiao init` completo
- Gerado com [asciinema](https://asciinema.org) + [svg-term-cli](https://github.com/marionebl/svg-term-cli) (versão portável)
- Seção "Antes/Depois": mesmo prompt com e sem claudiao instalado (print de Claude Code)
- Badges no topo: npm version, downloads, CI status, license
- Tabela clara de "O que vem instalado" com contagem
- Quickstart em 3 comandos no topo (não perdido no meio do arquivo)
- Link direto pra docs de cada agent/skill
**Estimativa:** 3-4h (gravação + edição + markdown)

### FEAT-027: Project health files
**Motivação:** Sem esses arquivos, o repo parece abandonado e contribuidores não sabem como ajudar. São padrão OSS hoje.
**Escopo:**
- `LICENSE` — arquivo físico (MIT já declarado em package.json, mas falta arquivo)
- `CONTRIBUTING.md` — fluxo de PR, como rodar testes, como adicionar changeset
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 (copy-paste)
- `SECURITY.md` — como reportar vulnerabilidades (email + responsabilidade)
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/new_agent_or_skill.md` (específico pra essa lib)
- `.github/PULL_REQUEST_TEMPLATE.md` — dogfood o próprio `/pr-template`
**Estimativa:** 2h pra tudo

### FEAT-028: Hooks cross-platform (rewrite em Node.js) — ✅ resolvido em 1.2.0
_Concluído. Scripts agora em `.mjs`, testes de integração com `spawnSync`, cleanup automático de `.sh` legados._

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

_FEAT-021 e FEAT-022 foram concluídas em 1.1.0 — ver seção "✅ Resolvido" no topo._

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

### FEAT-029: Landing page e docs site (GitHub Pages)
**Motivação:** Hoje, quem busca "claude code brasil" ou "claude code templates" no Google encontra no máximo a página do npm, que é feia. Landing page aumenta discoverability por SEO.
**Escopo:**
- Site estático em `docs/` via Astro ou Next.js (export)
- Deploy automático via GitHub Pages em push para main
- Seções: hero + quickstart + agent/skill reference + contribute
- Referência completa de cada agent e skill com exemplos de uso
- Blog integrado para posts de use case
- Analytics (Plausible ou Umami, privacy-friendly)
- Custom domain opcional (claudiao.dev ou similar)
**Estimativa:** fim de semana (12-16h)
**Dependência:** FEAT-026 (conteúdo visual) pra reusar

### FEAT-031: Bundles opt-in (re-priorizado para v1.3.0)
**Contexto:** O nome da branch `feat/v1.2.0-bugs-bundles-hooks` deixa claro que bundles era um dos três tracks planejados para 1.2.0, mas a feature não foi entregue — só os bugs e os hooks saíram. Nada foi publicado no CHANGELOG ou README como "disponível", então não há desinformação externa, mas o item precisa de lar explícito.
**Motivação:** Agrupar agents+skills relacionados (ex: bundle `backend-node` com `nodejs-specialist` + `security-checklist` + `pr-template`) facilita onboarding de novos times. Hoje o usuário precisa lembrar quais agentes combinam.
**Escopo esperado:**
- Conceito de bundle definido em YAML (nome, descrição, lista de agents/skills incluídos)
- `claudiao install bundle <nome>` instala todos os itens do bundle
- `claudiao list bundles` lista bundles disponíveis
- 3-4 bundles iniciais: `backend-node`, `backend-python`, `frontend-react`, `platform-aws`
- Interop com `list agents/skills`: flag que mostra a qual bundle cada item pertence
**Prioridade:** P0 para v1.3.0.

### FEAT-030: Modo `--verbose` e `CLAUDIAO_DEBUG`
**Descrição:** Flag global pra output detalhado em debugging.
**Motivação:** Hoje quando algo dá errado não há como ver detalhes (movido de DEBT-006 pra P2).
**Escopo:**
- Flag `--verbose` em todos os commands
- Env var `CLAUDIAO_DEBUG=1` como alternativa
- Logs detalhados: symlink source/target, resolução de paths, validação de frontmatter
- Integra com `doctor` pra mostrar por que cada check passou/falhou

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

### DEBT-001: Catch blocks silenciosos — ✅ resolvido em 1.3.0
_Anotação explícita `// expected: <razão>` em cada catch legítimo, + `debug()` via formato novo verbose. Runtime não é mais caixa preta — `--verbose`/`CLAUDIAO_DEBUG=1` expõe o motivo do ignore._

### DEBT-002: `console.log` espalhado nos commands — ✅ resolvido em 1.3.0
_Todos os `console.log/error/warn` em commands agora passam por `lib/format.ts` (funções tipadas + `output` namespace). Respeitam `setQuiet`/`setJsonMode` globais — preparado pra flags `--quiet` e `--json` futuras sem retrabalho em commands._

### DEBT-003: Duplicação de lógica dry-run — ✅ resolvido em 1.3.0
_Helper `dryRunnable(ctx, action, message)` em `lib/dry-run.ts`. Refatorado em `init`, `update` e `remove`. Novos commands dry-run-aware viram one-liner._

### DEBT-004: Sem validação do frontmatter ao instalar — ✅ resolvido em 1.2.0
_Concluído na branch `feat/v1.2.0-bugs-bundles-hooks`. Validação compartilhada via `src/lib/validate-frontmatter.ts` agora roda em `init`, `update` e `create`._

### DEBT-005: `install-plugin` sem validação de command injection
**Onde:** `src/commands/install-plugin.ts` → `execSync(plugin.installCommand)`
**Problema:** Seguro hoje (registry hardcoded), mas se o registry virar dinâmico (FEAT-006), é injection direto.
**Solução:** Sanitizar ou usar `spawn` com array de args em vez de `execSync` com string.

### DEBT-006: Sem modo verbose/debug — ✅ resolvido em 1.3.0
_Flag global `--verbose` (`-v`) + env var `CLAUDIAO_DEBUG=1` em `src/index.ts`. `debug()` do `lib/format.ts` emite `[debug]` em stderr só quando ativo. Catch blocks anotados logam pelo mesmo canal. Env var sempre vence pra facilitar CI/scripts._

### DEBT-007: Hook scripts sem testes de integração — ✅ resolvido em 1.2.0
_Concluído junto com FEAT-028. Integration tests em `src/lib/__tests__/hook-scripts.integration.test.ts`._

### DEBT-008: README desatualizado vs versão atual
**Onde:** `README.md`
**Problema:** README descreve funcionalidades da 1.0 mas não menciona hooks (1.1), validação de frontmatter no doctor (1.1), nem como usar os triggers de skill. Usuário que lê o README não sabe o que instalou.
**Solução:** Atualizar README com seção "What's new in 1.1" e, preferencialmente, estrutura evergreen com link para CHANGELOG em vez de repetir conteúdo. Resolver junto com FEAT-026.

---

## Go-to-Market — Adoção e Comunidade

> Não são features de produto, mas são pré-requisito pra lib sair do "uso pessoal" e virar adotada. Fazer só depois de FEAT-023 a FEAT-028 (infraestrutura) porque não adianta divulgar algo que ainda não suporta contribuição externa.

### GTM-001: Lançamento público inicial
**Motivação:** Claudião está em npm desde 1.0.0 mas sem anúncio formal. Sem divulgação, adoção fica em zero orgânico.
**Escopo:**
- Post de blog em pt-BR: "Como configurei meu Claude Code pra trabalhar no meu nível — apresentando claudião"
- Post em inglês complementar: "A CLI to manage Claude Code agents and skills (Portuguese-first, English-compatible)"
- Vídeo de 3-5min no YouTube mostrando instalação + uso real
- Thread no Twitter/X/Bluesky com GIFs
- Show HN (Hacker News) — considerar timing (manhã de terça, horário US)
- Post no r/ClaudeAI e r/brdev no Reddit
- Submissão para newsletters: Awesome Claude Code, Developer Tools Weekly
**Estimativa:** 2-3 dias de trabalho concentrado
**Dependência:** FEAT-026 (README visual), FEAT-029 (landing), FEAT-025 (CHANGELOG) prontos

### GTM-002: Comunidade
**Motivação:** Lib sobrevive por comunidade, não por autor solo. Precisa de canal de contato.
**Escopo:**
- Servidor Discord ou canal no Slack (escolha baseada em audiência — DevRel BR usa Discord mais)
- GitHub Discussions habilitado no repo (alternativa low-overhead ao Discord)
- Mailing list simples via Buttondown ou similar (opt-in pra release notes)
- Office hours mensal (live no Twitch/YouTube respondendo dúvidas e mostrando uso)
- Canal para submissão de agents/skills da comunidade (curadoria leve)
**Estimativa:** 1 dia pra setup + overhead contínuo

### GTM-003: Casos de uso reais (case studies)
**Motivação:** Testimonial vago ("usei e gostei") não convence. Números convencem.
**Escopo:**
- 3 estudos de caso com devs usando claudião em seus projetos
- Cada estudo: stack usada, quais agents/skills mais usados, métrica de ganho (tempo economizado, bugs evitados, PRs mais rápidos)
- Formato: post de blog + entrada na landing page
- Primeiro case study: você mesmo, usando em SpaceVis / DigAÍ / RouteEasy
**Estimativa:** 4-6h por case study

### GTM-004: Parcerias e menções
**Motivação:** Tráfego vem de endosso, não de push de features.
**Escopo:**
- Reach out pra criadores de conteúdo BR que falam de Claude/IA (filipedeschamps, Fabio Akita, Rocketseat)
- Submissão pra inclusão em listas "Awesome Claude Code", "Awesome DevTools"
- Sponsorship ou palestra em eventos: TDC, DevRelCon, The Developer's Conference
- Guest post em blogs técnicos relevantes
**Estimativa:** contínuo, 2-4h por semana

---

## Notas

- Prioridades podem mudar com feedback dos usuários
- Features de P2/P3 devem ser validadas com issue no GitHub antes de implementar
- Toda feature nova deve incluir testes e documentação no README
- Manter compatibilidade com Node.js 18+ (LTS)
