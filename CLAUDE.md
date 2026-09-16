# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

CLI chamada "claudião" para gerenciar agentes, skills, slash commands, hooks e regras globais do Claude Code. Instala via symlink em `~/.claude/` (agentes/skills/commands) ou por cópia (hooks e regras).

## Stack

- Node.js 18+ / TypeScript strict (ESM)
- Commander.js (CLI), Chalk v5 (cores), Inquirer v12 (prompts interativos), gray-matter (YAML frontmatter)

## Comandos de desenvolvimento

```bash
npm run build          # Compila TypeScript (tsc)
npm run dev            # Roda direto com tsx (sem compilar)
npm run typecheck      # Verifica tipos sem compilar
npm test               # vitest (src) + node:test (hooks) + unittest (skill)
npm run test:hooks     # Só a suíte dos hooks bundled
npm run test:skill     # Só o extrator da skill session-insights
npm run dev -- init    # Testar um comando específico
```

Três suítes, três runners:
- `src/lib/__tests__/` e `src/commands/__tests__/` → vitest, rodando **só** `src` (`dist/` fica de fora de propósito: tinha teste compilado antigo quebrando o `npm test`).
- `templates/hooks/tests/` → `node --test` com glob (`*.test.mjs`; passar o diretório quebra no Node 22).
- `templates/skills/session-insights/scripts/test-extract-episodes.py` → unittest.

O CI (`.github/workflows/ci.yml`) roda `npm test` no Node 18, 20 e 22.

## Arquitetura: 3 camadas

1. **Entry/Routing** (`src/index.ts`) — Árvore Commander: `init`, `create agent|skill`, `list`, `remove`, `update`, `doctor`, `hooks install|uninstall|list`, `rules install|list`, `statusline install|uninstall|list`, `attribution`
2. **Commands** (`src/commands/*`) — Lógica de negócio + prompts Inquirer
3. **Utilities** (`src/lib/*`) — paths, symlinks, templates, frontmatter, format, hooks, rules

## Decisões arquiteturais não-óbvias

### Symlinks para agentes/skills, cópia para hooks e regras
Agentes, skills e commands são symlinks de `~/.claude/` apontando para os templates: editar o template atualiza na hora. Hooks e regras são **copiados**, porque o Claude Code executa o script e o usuário pode querer divergir da versão do pacote. Por isso `rules install` nunca sobrescreve regra modificada localmente sem `--force`, e `hooks install` precisa ser rodado de novo após atualizar o pacote.

### Cascata de resolução de paths (external > bundled)
`lib/paths.ts`: repo externo configurado em `.claudiao.json` (`repoPath`) tem prioridade sobre o `templates/` que vem no pacote npm.

### Hooks: uma categoria pode cobrir vários eventos e levar dependências
`HookCategory` (`src/lib/hooks.ts`) tem `event` + `matcher` e mais dois campos:
- `extraEvents`: o mesmo script registrado em outros eventos (o `review-gate` usa `PreToolUse`, `SubagentStop` e `UserPromptSubmit`). O `matcher` só é aplicado em eventos que o suportam (`PreToolUse`/`PostToolUse`); nos outros a entrada vai sem matcher.
- `extraFiles`: arquivos que o script importa (`lib/shell.mjs`, `lib/portuguese.mjs`), copiados junto. `src/lib/__tests__/hook-dependencies.test.ts` falha se um `import` relativo não estiver declarado — inclusive transitivo.

`isClaudiaoHook` reconhece o hook pelo prefixo `claudiao-` no nome do arquivo: **todo hook novo precisa desse prefixo**, senão install/uninstall/list não o enxergam.

### Hook novo precisa do guard `invokedDirectly()`
O hook lê o payload de `fd 0`, e sem o guard qualquer `import` das suas funções trava no stdin para sempre — inclusive nos testes. Os 5 hooks de enforcement e o gate já têm; os lembretes antigos (`*-reminder.mjs`, `english-code`) ainda leem em top-level e só podem ser testados por subprocesso.

### Review gate: bloqueia o PR, não o fim do turno
`claudiao-review-gate.mjs` nega `gh pr create` e equivalentes enquanto o diff contra a branch base passar de 60 linhas sem revisão do agente `independent-reviewer`. Pontos que não são óbvios:
- a base é o **merge-base** com `origin/HEAD`/`main`/`master`/`develop`/`trunk`, não a árvore do início da sessão: o que importa é o que vai no PR, mesmo feito em outra sessão;
- depois de uma revisão registrada, a base vira a árvore revisada;
- o registro da revisão e o bloqueio usam a **mesma** base; se divergirem, o PR trava sem saída;
- o gate julga só o repo onde o PR está sendo aberto;
- o prompt do revisor precisa citar todos os arquivos alterados;
- o usuário libera terminando a mensagem com `sem review`.

### Parsing de comando shell é compartilhado
`templates/hooks/lib/shell.mjs` expõe `unquotedSegments` (divide em `&&`, `||`, `|`, `;` e newline respeitando aspas) e `commandSegments` (remove wrappers como `sudo`, `timeout`, `xargs`, `then`, parênteses e atribuições, e entra em `bash -c`/`eval`). Hook que decide por comando deve usar `commandSegments`, senão escapa por wrapper — foi assim que `PR_URL=$(gh pr create)` furou o gate.

### Conteúdo publicado no npm é genérico
`templates/` vai no pacote público: nada de nome de pessoa, host de banco, usuário de Vault, ticket real ou caminho de máquina. `files` exclui `templates/hooks/tests` e `templates/**/__pycache__`.

### settings.json: leitura leniente vs. estrita
`readSettings()` (leniente, para `list`/`doctor`) × `readSettingsForWrite()` (estrita, obrigatória em read→modify→write, para nunca apagar config de outros plugins). `writeSettings()` é atômica (tmp + rename).

### Gestão de plugins foi removida (v1.5.0)
Plugins são responsabilidade do sistema nativo (`claude /plugin`). `claudiao install` é só stub de deprecação.

## Convenções

- ESM (`"type": "module"`), imports com extensão `.js` (moduleResolution nodenext)
- Output da CLI em português brasileiro; nomes de arquivo em kebab-case
- Sem `any` — TypeScript strict
- Todos os paths via `lib/paths.ts` (nunca hardcode `~/.claude`)
- Output sempre via `lib/format.ts`; frontmatter via `lib/frontmatter.ts`
- Zero comentários no código, aqui como em qualquer repo
