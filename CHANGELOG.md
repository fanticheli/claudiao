# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
