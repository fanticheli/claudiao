# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [1.5.0] — 2026-04-19

Release com dois temas integrados: simplificação de escopo (remoção da gestão de plugins de terceiros) e nova feature de statusline.

### Added

- **Statusline de contexto** (`claudiao statusline install|uninstall|list`): novo script bundled (`templates/statusline/context-bar.mjs`) que renderiza barra no rodapé do Claude Code com diretório, branch do git, modelo em uso, percentual de contexto usado (verde <60%, amarelo 60-85%, vermelho >85%) e custo acumulado da sessão em USD. Lê `context_window.used_percentage` do schema do Claude Code 2.1.x, com fallback pra soma de `input + output + cache_creation + cache_read` sobre `context_window_size`.
- Biblioteca `src/lib/statusline.ts` com helpers para instalar/remover/inspecionar a `statusLine` em `~/.claude/settings.json`. Segue o mesmo padrão dos hooks: copia o script pra `~/.claude/statusline/context-bar.mjs` e grava só `statusLine` no `settings.json` (preserva demais campos).
- `claudiao init` passa a oferecer a statusline como opt-in (default `yes`) no fluxo interativo.
- `claudiao doctor` reporta o estado da statusline (instalada pelo claudião, foreign, ou ausente).
- 12 testes unitários em `src/lib/__tests__/statusline.test.ts` cobrindo detecção, cópia do script, merge em settings.json, e preservação de statusLine de outras origens no uninstall.

### Removed (BREAKING)

- **`claudiao install plugin <nome>`** — substituído por stub de deprecação que imprime mensagem e sai com exit code 1. Use `claude /plugin install <nome>` (nativo do Claude Code).
- **`claudiao list plugins`** — subcomando removido do parser. Use `claude /plugin list` (nativo do Claude Code).
- **`src/lib/plugins.ts`** — registry hardcoded de plugins (`superpowers`, `get-shit-done`, `claude-mem`) removido. Interface `PluginInfo` também removida de `src/types.ts`.
- **Prompt de plugins no `claudiao init`** — o init deixa de perguntar "quer instalar plugins da comunidade?".

### Migration

Se você usava `claudiao install plugin superpowers`, substitua por:

```bash
claude /plugin install superpowers
```

Usuários upgrade-ando da 1.3.x podem optar pela statusline via `claudiao statusline install`. Nenhuma outra feature foi afetada. Agents, skills, hooks e CLAUDE.md global continuam funcionando idênticos à v1.3.x.

### Rationale

- **Remoção de plugins**: Claude Code tem sistema próprio de plugins (`claude /plugin`) mantido pela Anthropic. Duplicar essa responsabilidade no claudião adicionava superfície de manutenção sem valor real — o registry hardcoded desatualizava a cada novo plugin da comunidade.
- **Statusline**: quem usa Opus 4.7 com 1M de contexto precisa saber quando a sessão tá se aproximando do limite. A statusLine do Claude Code é o ponto natural pra surfacear isso em tempo real. Ver `BACKLOG.md` → "Gestão de plugins de terceiros — removido em v1.5.0".

## [1.3.2] — 2026-04-19

### Fixed

- **Stop hook emitia JSON inválido**: `claudiao-pr-reminder.mjs` usava `hookSpecificOutput.hookEventName: "Stop"`, mas o schema do Claude Code só aceita `hookSpecificOutput` para `PreToolUse`/`UserPromptSubmit`/`PostToolUse`. Trocamos para `systemMessage` no top-level (campo válido para Stop hooks). Bug introduzido na v1.3.0.
- **Validador de frontmatter rejeitava `tools` em YAML array**: agents legítimos que usam o estilo `tools:\n  - Read\n  - Write` (suportado pelo Claude Code) eram flagados como `error` no `claudiao doctor`. O validador agora aceita CSV string *ou* array de strings. Só rejeita formatos que não são nenhum dos dois (ex: objeto aninhado).

## [1.3.1] — 2026-04-19

### Fixed

- Include `CHANGELOG.md` and `BACKLOG.md` in the published npm tarball (missing from v1.3.0 tarball).
- Exclude test files (`dist/**/__tests__/**`, `dist/**/*.test.*`) from the published package via a dedicated `tsconfig.build.json` used by `npm run build`.
- Complete DEBT-001 coverage: all catch blocks in `install-plugin.ts`, `doctor.ts`, `init.ts` and `update.ts` now carry an explicit `// expected:` comment or active treatment (log/surface).

## [1.3.0] — 2026-04-19

### Added

- **Stop hook (`pr` category)**: novo hook que roda no evento `Stop` do Claude Code, lembrando `/pr-template` e `/security-checklist` ao finalizar sessão com edits. Detecta sessões só-leitura via `tool_use_count`, `has_edits` ou parsing de `transcript_path` e passa em silêncio quando não há o que lembrar. Fecha o loop do fluxo identificado na validação de 18/04/2026 — complementa os hooks `PreToolUse` que cobriam apenas a fase de edição.
- `HookEvent` type em `src/lib/hooks.ts` inclui `Stop` além de `PreToolUse`/`PostToolUse`. `HookCategory.matcher` agora é `string | null` para permitir eventos sem matcher (como `Stop`).
- **Modo verbose** via flag global `--verbose` (`-v`) ou env var `CLAUDIAO_DEBUG=1`. `debug()` em `src/lib/format.ts` emite `[debug]` lines em stderr explicando resolução de paths, catches silenciados e decisões de symlink. Env var sempre vence sobre `--verbose=false` pra facilitar CI/scripts.
- Helper `dryRunnable(ctx, action, message)` em `src/lib/dry-run.ts`. Substitui os if/else duplicados de dry-run em `init`, `update` e `remove`.
- `output` namespace em `src/lib/format.ts` expondo `info/success/warn/error/debug/raw/table/json/banner/dim/heading/separator`. Respeita `setQuiet` e `setJsonMode` — permite implementar `--quiet`/`--json` no futuro sem retocar cada command.

### Changed

- `claudiao hooks list` e o diálogo de confirmação de `uninstall` exibem `(none)` para hooks sem matcher (antes mostravam string vazia).
- Output dos commands roteado integralmente por `src/lib/format.ts` (sem `console.log` direto em `init`, `update`, `remove`, `list`, `doctor`, `hooks`, `install-plugin`, `create`). Comportamento visível inalterado.
- Catch blocks silenciosos em `paths.ts`, `hooks.ts`, `symlinks.ts`, `init.ts`, `update.ts`, `list.ts`, `doctor.ts` e `install-plugin.ts` agora carregam comentário `// expected: <razão>` e (quando faz sentido) logam o erro via `debug()`.

### Docs

- Nova seção **"Troubleshooting"** no README mostrando como rodar com `--verbose`/`CLAUDIAO_DEBUG=1`.
- Nova seção **"Relação com outros plugins do Claude Code"** no README clarificando que `superpowers`/`get-shit-done` são plugins separados do Claude Code, instalados via `claude /plugin install` — não bundled no pacote claudiao.
- BACKLOG registra a decisão de adiar bundles opt-in (era FEAT-023) por falta de caso de uso concreto; será revisitado quando houver pelo menos 3 pedidos diferentes de usuários querendo empacotar conjuntos próprios de agents/skills.

## [1.2.1] — 2026-04-18

### Fixed

- **Regressão da 1.2.0**: `claudiao doctor` reportava todos os symlinks válidos como quebrados quando rodado de um CWD diferente do diretório do symlink. A checagem usava `existsSync(readlinkSync(path))`, que resolve paths relativos contra `process.cwd()`. Agora a validação está centralizada em `isSymlinkBroken` (`src/lib/symlinks.ts`) e resolve contra o diretório do symlink.
- `claudiao hooks install --only a,b` ignorava silenciosamente a primeira categoria. `mergeHooksIntoSettings` rodava a etapa de limpeza dentro do loop por categoria, então a segunda iteração apagava as entradas que a primeira tinha acabado de escrever.
- Hook de migration agora dispara em `Write|Edit` em vez de só `Write`, cobrindo edição de migrations SQL existentes. Instalações da 1.2.0 são auto-migradas silenciosamente no próximo `claudiao hooks install` (apenas entradas gerenciadas pelo claudião são alteradas).

### Added

- `claudiao hooks uninstall --only <categorias>` — paridade com o `install`. Remove apenas as categorias informadas, preservando as demais e hooks de outros plugins.
- Helper `parseOnlyFlag` em `src/lib/hooks.ts` compartilhado por install e uninstall (trim, lowercase, dedupe, validação de ids).
- Helper `migrateClaudiaoHookMatchers` em `src/lib/hooks.ts` que realinha matchers desatualizados de instalações antigas com o valor canônico das `HOOK_CATEGORIES` atuais.

## [1.2.0] — 2026-04-18

### Added

- `claudiao list agents` e `list skills` agora mostram coluna `[core|external|local]` que identifica onde o arquivo está (pacote bundled, repo externo configurado via `repoPath`, ou criado manualmente pelo usuário).
- Helper `getInstallSource` em `src/lib/symlinks.ts` resolve a origem de um symlink comparando o target com o `PACKAGE_ROOT`.

### Changed

- **Hooks bundled reescritos em Node.js** (`.mjs`). Os 4 reminders (`security`, `ui`, `migration`, `commit`) agora funcionam em Linux, macOS e Windows nativo sem depender de bash, grep ou sed. Resolve FEAT-028 do backlog. `claudiao hooks install` migra entradas `.sh` legadas do `~/.claude/settings.json` automaticamente e remove scripts `.sh` órfãos de `~/.claude/hooks/`.
- `claudiao update` agora atualiza o campo `version` no `.claudiao.json` a cada execução, refletindo o pacote instalado.
- `claudiao doctor`, `update`, `init` e `create` compartilham a mesma lógica de validação de frontmatter via `src/lib/validate-frontmatter.ts`.

### Fixed

- **BUG-001**: `.claudiao.json` agora grava a versão real do pacote lida de `package.json` em vez do fallback hardcoded `"1.0.0"`. `claudiao update` sincroniza o campo a cada execução.
- **BUG-002**: symlinks criados em `~/.claude/` agora usam paths relativos em vez de absolutos, sobrevivendo a mudanças de `nvm`/`volta`, renomeação do diretório de instalação ou migração entre máquinas. Em Windows (junctions), paths absolutos são mantidos por restrição do SO.
- **DEBT-004**: validação de frontmatter agora roda no `init`, `update` e `create` — agents/skills com frontmatter inválido são reportados com `✗` e pulados em vez de instalados silenciosamente. Warnings (description curta, sem gatilho explícito) continuam instalando mas aparecem no output.
- **DEBT-007**: hooks bundled agora têm testes de integração que fazem `spawnSync` dos scripts reais com payload JSON via stdin (15 testes cobrindo match positivo, match negativo, filenames com caracteres especiais e JSON malformado).

## [1.1.0] — 2026-04-17

### Added

- Sistema de hooks (`claudiao hooks install|uninstall|list`) que lembra de invocar skills em momentos-chave: editar endpoint (`/security-checklist`), componente (`/ui-review-checklist`), migration SQL (`/sql-templates`) e commit (conventional commit validation).
- Validação de frontmatter no `doctor` — detecta agents/skills com `name`/`description`/`tools`/`model` ausentes ou malformados, com severidade error/warn.
- Guia de integração com CLIs de cloud (AWS, Azure, GCP) para os agents `aws-specialist`, `azure-specialist` e `gcp-specialist`.

### Changed

- Template do `pr-reviewer` reforçado com checklist mais rigoroso.
- Templates de skills revisados para incluir gatilhos explícitos ("use when", "ative quando") nos frontmatters.
- CLAUDE.md global endurecido: regras universais de código mais explícitas, nível sênior como default.
- Vitest downgrade para v3.x — compatibilidade com Node 18 LTS.

## [1.0.0] — 2026-03-20

### Added

- Release inicial.
- CLI `claudiao` com comandos `init`, `update`, `doctor`, `list`, `create`, `remove`, `install`.
- 18 agents especializados (architect, aws/azure/gcp-specialist, database-specialist, dod-specialist, idea-refiner, implementation-planner, nodejs-specialist, pr-reviewer, product-owner, project-manager, prompt-engineer, python-specialist, react-specialist, security-specialist, test-specialist, uxui-specialist).
- 9 skills (architecture-decision, meet-dod, pm-templates, pr-template, product-templates, python-patterns, security-checklist, sql-templates, ui-review-checklist).
- CLAUDE.md global opinado (pt-BR, TypeScript strict, nível sênior).
- Wizard interativo de criação de agents e skills.
- Registry de 3 plugins da comunidade (superpowers, get-shit-done, claude-mem).
- Doctor com diagnóstico de instalação e symlinks.
- Suporte a repo externo de agents/skills via `.claudiao.json` → `repoPath`.

[Unreleased]: https://github.com/fanticheli/claudiao/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/fanticheli/claudiao/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/fanticheli/claudiao/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fanticheli/claudiao/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fanticheli/claudiao/releases/tag/v1.0.0
