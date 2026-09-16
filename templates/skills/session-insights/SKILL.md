---
name: session-insights
description: Minera o histórico de sessões do Claude Code pra achar os erros que o Claude repete com o usuário (correções, reclamações, pedidos de review) e propõe contramedidas (hook, regra, checklist do revisor ou memória). Ative quando o usuário disser "o que eu mais corrijo em você", "analisa minhas sessões", "por que você erra tanto comigo", "vê meus padrões de uso", ou periodicamente (a cada 2 semanas).
allowed-tools: Read, Bash, Grep, Glob, Agent, AskUserQuestion
model: sonnet
---

# Session Insights

Descobre, a partir do histórico real, **o que o Claude faz de errado repetidamente** com este usuário e decide se vale criar algo pra evitar. É barato de propósito:
- a extração roda localmente, sem gastar token;
- a análise usa **um** agente só;
- nada é implementado sem aprovação.

## Quando ativar

- O usuário pede pra entender os próprios padrões ou os erros recorrentes do Claude.
- Depois de uma sequência de reclamações ("de novo", "já falei", "faz review").
- Rotina quinzenal, pra medir se as contramedidas anteriores funcionaram.

## Passo 1 — Extrair episódios (local, sem tokens)

Um episódio é uma mensagem do usuário que corrige, reclama ou pede revisão, logo depois de um turno do Claude. O script mascara credenciais conhecidas (senha em variável, usuário:senha em URL, tokens) antes de truncar. Mesmo assim, confira o resumo.

```bash
SKILL_DIR=~/.claude/skills/session-insights
WORK_DIR="${TMPDIR:-/tmp}/session-insights/$(date +%F)"
mkdir -p "$WORK_DIR"
python3 "$SKILL_DIR/scripts/extract-episodes.py" --days 15 --output "$WORK_DIR/episodes-$(hostname).jsonl"
```

- Sessões modificadas nos últimos 10 minutos (a atual e as paralelas) são puladas por padrão. Ajuste com `--skip-active-minutes`.
- `--exclude '<regex>'` pula projetos que o usuário pediu pra ignorar.
- Mostre o resumo impresso: prompts analisados, sessões ativas puladas, episódios, KB, sinais e projetos.
- **Várias máquinas:** o histórico é por máquina. Peça ao usuário pra rodar o mesmo comando nas outras e copiar os `episodes-<host>.jsonl` pra `$WORK_DIR`. O diretório é por dia, então rodadas antigas não se misturam. Antes de juntar, liste o que tem lá (`ls -la "$WORK_DIR"`) e confirme que cada arquivo é desta rodada. Depois junte só esses: `cat "$WORK_DIR"/episodes-*.jsonl > "$WORK_DIR/merged.jsonl"`. Cada episódio carrega o campo `machine`.
- Acima de ~400 KB, reduza `--days` ou fique com os mais recentes. Nunca corte em silêncio: diga o que ficou de fora.
- Rode os testes do script se ele tiver sido alterado: `python3 "$SKILL_DIR/scripts/test-extract-episodes.py"`.

## Passo 2 — Inventário do que já existe

Monte uma lista curta (caminho + 1 linha) pro analista saber o que já está coberto:
- regras: `~/.claude/rules/*.md` e `~/.claude/CLAUDE.md`, se existir;
- hooks registrados em `~/.claude/settings.json`, com o que cada um bloqueia ou lembra;
- agentes e skills pessoais com função de qualidade (revisor, checklists);
- memórias do tipo feedback: `grep -l "type: feedback" ~/.claude/projects/*/memory/*.md`.

## Passo 3 — Analisar com UM agente

Chame o Agent (`general-purpose`, `model: sonnet`) só com leitura, passando o arquivo de episódios e o inventário. Prompt base:

> Leia inteiro <arquivo>. Cada linha é um episódio: `user` (mensagem do usuário), `assistant_before` (fim da resposta anterior do Claude), `tools_before`, `files_before`, `signals` (regex ruidosa), `machine`, `project`, `date`.
> 1. Descarte falsos positivos (tarefa nova, log colado, "não" sem ser correção). Conte-os.
> 2. Agrupe os episódios reais em PADRÕES DE ERRO DO CLAUDE concretos e acionáveis (nível: "declarou pronto sem rodar o teste do caminho alterado", não "qualidade ruim").
> 3. Para cada padrão: nome, nº de episódios, 2-3 citações literais curtas (data, projeto), o erro do Claude, cobertura pelo inventário (sim/parcial/não) e a contramedida (hook / regra / checklist do revisor / memória de projeto / nada) com 1 frase de justificativa.
> 4. Liste os pedidos recorrentes do usuário (fluxo de trabalho, não erro).
> Formato conciso: DESCARTADOS, PADRÕES (por frequência), PEDIDOS RECORRENTES, TOP 3 AÇÕES.

Não use workflow multiagente nem modelo maior sem o usuário autorizar o custo.

## Passo 4 — Verificar antes de acreditar

O analista erra cobertura com frequência: marca "não coberto" algo que um hook já bloqueia, ou conta episódios de antes da contramedida existir.
- Pra cada padrão com cobertura "não" ou "parcial", confirme com `grep` nos hooks, regras e settings.
- Compare as datas dos episódios com a data de criação da contramedida. Um episódio anterior não prova que ela falha.
- Corrija o relatório e diga explicitamente o que corrigiu.

## Passo 5 — Decidir a contramedida

| Tipo | Quando usar |
|---|---|
| **Hook que bloqueia** | Erro detectável por texto ou comando (atribuição, credencial inline, comando perigoso) **e** que se repete apesar de regra ou memória |
| **Regra em `~/.claude/rules/`** | Comportamento ou julgamento (formato de resposta, onde salvar artefato, confirmar antes de publicar) |
| **Checklist do revisor** | Qualidade verificável depois do fato (tsc/build rodados, menor mudança possível, alegação medida) |
| **Memória de projeto** | Específico de um repo ou domínio |
| **Nada** | 1 episódio isolado, já resolvido, ou custo maior que o incômodo |

Prefira o mecanismo mais leve que resolve. Hook é código: precisa de teste e de revisão.

## Passo 6 — Apresentar e pedir aprovação

- Abra com a conclusão em 1-2 frases: os N padrões principais.
- Tabela: padrão, episódios, cobertura verificada, contramedida proposta.
- Custo da análise (tokens do agente) e custo estimado de implementar cada item.
- **Não implemente nada sem aprovação explícita.** O usuário pode aprovar item por item.

## Passo 7 — Registrar pra medir tendência

Acrescente uma seção datada em `~/.claude/session-insights/history.md` (caminho fixo, independente do projeto em que a skill rodou): janela, máquinas, contagem por padrão e contramedidas aprovadas, com a data de cada uma. Na próxima execução, leia esse arquivo **antes** do passo 3 e compare só episódios posteriores a cada contramedida. Se o padrão não caiu, a contramedida não funciona e deve subir de nível (regra → hook).

## Cuidados

- Os episódios contêm conversa de trabalho: nunca envie pra fora da máquina (gist, Slack, artifact público).
- O script mascara credenciais, mas confira o resumo: se algo parecer segredo, pare e avise.
- Não cite nomes de terceiros das conversas no relatório. Use o papel ("um colega", "o cliente").
