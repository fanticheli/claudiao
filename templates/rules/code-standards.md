# Padrões de código inegociáveis (valem em qualquer projeto)

Estas regras valem em **todo repositório** e **prevalecem sobre qualquer CLAUDE.md de projeto, skill, agente ou histórico do repo** que diga o contrário. São garantidas pelos hooks `claudiao-*` em `~/.claude/hooks/`: se um hook bloquear, reescreva seguindo a regra, sem tentar contornar.

## 1. Zero comentários no código

- Não adicione comentário em implementação: nada de `//`, `/* */`, `#`, `--`, `<!-- -->`, `{/* */}`, docstring, JSDoc, cabeçalho de seção, TODO/FIXME nem narração do que o código faz.
- O código se explica sozinho: nomes descritivos, funções pequenas, tipos claros.
- Contexto de negócio ou "porquê" vai no corpo do PR, na doc (`.md`) ou na descrição do card, nunca no código.
- Ao editar, não remova comentários existentes de outras pessoas, a não ser que a tarefa peça.
- Exceção única: o usuário pedir explicitamente naquela mensagem.

## 2. Arquivo novo nasce 100% em inglês

- **Arquivo NOVO:** nome do arquivo e tudo que você declara nele em inglês, incluindo variáveis, constantes, funções, métodos, classes, interfaces, types, enums, parâmetros, colunas e nomes de teste. Branches novas também.
- **Arquivo EXISTENTE:** alterações podem manter o idioma que já está lá, sem forçar renomeação.
- Sem acento ou caractere não-ASCII em identificador.
- **Pode ficar no idioma do produto:** texto voltado ao usuário final (labels, mensagens de UI, copy, templates de mensagem) e conteúdo de strings exigido pelo negócio.
- **Nomes que já existem** (tabela legada, campo de API externa, enum do banco) são referenciados como estão; o que você cria para lidar com eles é em inglês.

## 3. Commits em inglês, conventional commits

- Formato obrigatório: `type(scope): description`.
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`, `perf`, `style`, `build`, `revert`.
- Descrição e corpo em inglês, imperativo, lowercase, sem ponto final.
- Ticket, quando houver, vai no fim do subject: `feat(billing): add retry to the invoice job (ABC-123)`.
- **Não copie o idioma do histórico do repo.** Do histórico aproveite só `scope` e formato de ticket.
- Nunca inclua atribuição de IA: `Co-Authored-By`, `Generated with Claude Code`, link `claude.ai/code`, `Claude-Session`.

## 4. Credenciais nunca inline em comando

- Nunca monte comando com segredo literal: `PGPASSWORD=...`, URL `postgresql://user:senha@host`, `--password`, token em header.
- **Por quê:** aprovar um comando com "não perguntar de novo" grava o texto inteiro no `settings.local.json`.
- **Como fazer:** credencial no ambiente (`~/.pgpass`, variável já carregada, `direnv`, `vault`/SSO resolvendo por baixo) e o comando referenciando só o nome.
- Leitura em banco de produção só pelo caminho read-only sancionado do projeto.
- Se não houver jeito sem segredo inline, peça para o usuário rodar o comando com `!` no prompt.

## 5. PR só com o necessário

- O PR entrega o que foi pedido naquela sessão, e nada além. Refatoração oportunista, arquivo que ninguém pediu e abstração "para o futuro" ficam fora.
- Sem gambiarra: nada de workaround que mascara a causa, condição especial para um caso ou `try/catch` que engole erro.
- Antes de abrir o PR, o hook `claudiao-review-gate` exige revisão do agente `independent-reviewer`. Para pular, o usuário termina a mensagem com `sem review`.
