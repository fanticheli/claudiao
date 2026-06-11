# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

CLI chamada "claudião" para gerenciar agentes, skills e plugins do Claude Code. Instala, cria, lista, atualiza e remove agentes/skills via symlinks em `~/.claude/`.

## Stack

- Node.js 18+ / TypeScript strict (ESM)
- Commander.js (CLI), Chalk v5 (cores), Inquirer v12 (prompts interativos), gray-matter (YAML frontmatter)

## Comandos de desenvolvimento

```bash
npm run build          # Compila TypeScript (tsc)
npm run dev            # Roda direto com tsx (sem compilar)
npm run typecheck      # Verifica tipos sem compilar
npm test               # Roda a suíte vitest
npm run dev -- init    # Testar um comando específico
```

Testes vivem em `src/lib/__tests__/` (vitest). A camada `lib/` é bem coberta; os comandos (`src/commands/*`) ainda não têm testes (FEAT-003 no BACKLOG.md).

## Arquitetura: 3 camadas

1. **Entry/Routing** (`src/index.ts`) — Árvore de comandos Commander: `init`, `create agent|skill`, `list agents|skills|commands`, `remove agent|skill|command`, `update`, `doctor`, `hooks install|uninstall|list`, `statusline install|uninstall|list`
2. **Commands** (`src/commands/*`) — Lógica de negócio + prompts Inquirer. Cada arquivo exporta uma função async que é chamada pelo Commander
3. **Utilities** (`src/lib/*`) — Serviços reutilizáveis: paths, symlinks, templates, frontmatter, format, plugins

Fluxo típico: User → Commander → Command → Lib utilities → Filesystem → Output formatado.

## Decisões arquiteturais não-óbvias

### Symlinks como estratégia central
Agentes/skills são instalados como symlinks de `~/.claude/agents/` e `~/.claude/skills/` apontando para os arquivos fonte. Isso permite "live reload" — editar o template atualiza automaticamente o Claude Code sem re-install. O módulo `lib/symlinks.ts` faz backup `.bak` antes de sobrescrever arquivos não-symlink.

### Cascata de resolução de paths (external > bundled)
`lib/paths.ts` resolve caminhos em cascata:
- **External repo** (configurado em `.claudiao.json` com `repoPath`) — para usuários avançados com repo Git próprio
- **Bundled** (`templates/`) — agentes/skills que vêm com o npm package

### Agents = arquivo .md, Skills = diretório com SKILL.md, Commands = arquivo .md
Agentes são um único `.md` com YAML frontmatter. Skills vivem em `~/.claude/skills/{name}/SKILL.md` (diretório permite expansão futura). Slash commands são `.md` standalone em `~/.claude/commands/` — não exigem `name:` no frontmatter (derivado do filename).

### Gestão de plugins foi removida (v1.5.0)
O registry hardcoded (`lib/plugins.ts`) foi removido — plugins são responsabilidade do sistema nativo do Claude Code (`claude /plugin`). `claudiao install` existe só como stub de deprecação.

### settings.json: leitura leniente vs. estrita
`lib/hooks.ts` expõe duas leituras de `~/.claude/settings.json`: `readSettings()` (leniente — JSON inválido vira `{}`, usada por fluxos read-only como `list`/`doctor`) e `readSettingsForWrite()` (estrita — JSON inválido lança `MalformedSettingsError`, obrigatória em qualquer fluxo read→modify→write para nunca sobrescrever config do usuário). `writeSettings()` é atômica (tmp + rename).

## Convenções

- ESM (`"type": "module"` no package.json)
- Imports com extensão `.js` (requerido por moduleResolution nodenext)
- Output da CLI em português brasileiro
- Nomes de arquivo em kebab-case
- Sem `any` — TypeScript strict
- Todos os paths resolvidos via `lib/paths.ts` (nunca hardcode `~/.claude`)
- Output formatado sempre via `lib/format.ts` (banner, success, warn, error, table)
- Frontmatter YAML parseado via `lib/frontmatter.ts` com gray-matter
