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
npm run dev -- init    # Testar um comando específico
```

Não há testes automatizados no projeto atualmente.

## Arquitetura: 3 camadas

1. **Entry/Routing** (`src/index.ts`) — Árvore de comandos Commander com subcomandos (`create agent|skill`, `list agents|skills|plugins`, `remove agent|skill`)
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

### Agents = arquivo .md, Skills = diretório com SKILL.md
Agentes são um único `.md` com YAML frontmatter. Skills vivem em `~/.claude/skills/{name}/SKILL.md` (diretório permite expansão futura).

### Registry de plugins hardcoded
`lib/plugins.ts` tem um array estático de 3 plugins (superpowers, get-shit-done, claude-mem). Novos plugins requerem atualizar o código.

## Convenções

- ESM (`"type": "module"` no package.json)
- Imports com extensão `.js` (requerido por moduleResolution nodenext)
- Output da CLI em português brasileiro
- Nomes de arquivo em kebab-case
- Sem `any` — TypeScript strict
- Todos os paths resolvidos via `lib/paths.ts` (nunca hardcode `~/.claude`)
- Output formatado sempre via `lib/format.ts` (banner, success, warn, error, table)
- Frontmatter YAML parseado via `lib/frontmatter.ts` com gray-matter
