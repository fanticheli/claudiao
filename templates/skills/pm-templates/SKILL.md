---
name: pm-templates
description: Templates para gestão de projetos — user stories, ADRs, sprint planning, retrospectivas e roadmaps. Use quando precisar criar artifacts de PM.
allowed-tools: Read, Write, Edit, AskUserQuestion
model: sonnet
---

# Project Management Templates

Templates de gestão de projetos. Cobrem ciclo completo: refinement → planning
→ execution → retro → roadmap. Todos em pt-BR, prontos pra colar em
Jira/Notion/Linear/GitHub.

## Quando ativar

- Escrevendo user stories ou critérios de aceitação
- Definindo Definition of Ready / Definition of Done
- Documentando decisões arquiteturais (ADR)
- Planejando sprint, quarter ou roadmap
- Facilitando retrospectiva
- Quebrando épico em stories

---

## User Story

```markdown
## [ID] — [Título curto e específico]

**Como** [persona específica — não "usuário"],
**Eu quero** [ação concreta],
**Para que** [benefício mensurável].

### Contexto
[Por que agora? Link para feedback, dado, discovery que motivou.]

### Critérios de Aceitação (Given-When-Then)
- [ ] **Dado** [contexto inicial], **quando** [ação do usuário], **então** [resultado observável]
- [ ] **Dado** [contexto], **quando** [ação], **então** [resultado]
- [ ] **Dado** [caso de erro], **quando** [ação], **então** [comportamento esperado]

### Fora de Escopo
<!-- O que você sabe que vai ser perguntado e a resposta é "não" -->
- [item que NÃO vai entrar nesta story]
- [funcionalidade futura mapeada em outra story]

### Notas Técnicas
- Módulos afetados: [lista]
- Dependências: [outras stories, times, integrações]
- Riscos: [o que pode dar errado]

### Definition of Done
- [ ] Critérios de aceitação atendidos
- [ ] Testes unitários + integração
- [ ] Code review aprovado
- [ ] Documentação atualizada (se API pública mudou)
- [ ] Deploy em staging validado
- [ ] Monitoramento/alerta configurado (se fluxo crítico)
- [ ] Feature flag (se rollout gradual)

### Estimativa
- Story Points: [X]  (baseado em velocity histórica, não em horas)
- T-Shirt: [S / M / L / XL]
- Confidence: [alta / média / baixa] — se baixa, faz spike primeiro
```

---

## Definition of Ready (DoR) — quando uma story entra no sprint

Antes de aceitar uma story no sprint, validar:

```markdown
## DoR Checklist

- [ ] Problema claro, não apenas solução
- [ ] Persona específica identificada
- [ ] Critérios de aceitação escritos em Given-When-Then
- [ ] Fora de escopo explicitado
- [ ] Mockup/wireframe se tem UI
- [ ] Dependências identificadas (outros times, integrações)
- [ ] Estimada pelo time (planning poker ou consenso)
- [ ] Sem bloqueios pendentes
- [ ] Cabe num sprint (se não, quebrar)
```

---

## Definition of Done (DoD) — quando uma story pode ser fechada

```markdown
## DoD — [Story]

### Implementação
- [ ] Código na branch `main` (ou trunk)
- [ ] Sem TODOs/FIXMEs sem issue vinculada
- [ ] TypeScript strict sem `any`

### Testes
- [ ] Unit tests cobrindo happy path + edge cases
- [ ] Integration test se fluxo cruza módulos
- [ ] E2E se user-facing crítico
- [ ] Cobertura mantida ou aumentada

### Qualidade
- [ ] Code review aprovado por ≥1 revisor
- [ ] Lint + typecheck + build passam no CI
- [ ] Performance medida (se hot path)

### Deploy
- [ ] Merged e deployado em staging
- [ ] Smoke test manual em staging
- [ ] Feature flag configurada (se rollout gradual)

### Observabilidade
- [ ] Logs estruturados
- [ ] Métrica de negócio instrumentada (se fluxo crítico)
- [ ] Alerta configurado

### Documentação
- [ ] README/docs atualizados
- [ ] Changelog com entrada
- [ ] Stakeholders notificados (se user-facing)
```

---

## ADR (Architecture Decision Record)

```markdown
# ADR-NNN: [Título da Decisão]

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY
**Data:** YYYY-MM-DD
**Decisores:** [nomes]

## Contexto
[Qual problema estamos resolvendo? Quais constraints (time, budget, tech,
regulatório) existem? Por que agora?]

## Decisão
[O que decidimos fazer em 1-2 frases claras.]

## Alternativas Consideradas

### Opção A: [nome] ✅ (escolhida)
- Prós: ...
- Contras: ...
- Custo estimado: [tempo / $ / complexidade]

### Opção B: [nome]
- Prós: ...
- Contras: ...
- Motivo da rejeição: ...

### Opção C: [nome]
- Prós: ...
- Contras: ...
- Motivo da rejeição: ...

## Consequências

### Positivas
- [benefício concreto]

### Negativas
- [trade-off aceito]

### Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
|       |              |         |           |

## Gatilhos para Revisitar
- Se [volume > X], avaliar Opção B
- Se [time crescer pra N devs], reconsiderar
- Em [data], revisar decisão

## Referências
- [Link para benchmark, artigo, issue, discussion]
```

---

## Sprint Planning

```markdown
## Sprint [N] — [YYYY-MM-DD] a [YYYY-MM-DD]

### Sprint Goal
<!-- UMA frase que orienta decisões durante o sprint -->

### Capacidade
- Devs: [N] pessoas
- Dias úteis: [N] (descontando feriados, férias)
- Velocity média (últimos 3 sprints): [X] SP
- Capacidade estimada: [X] SP (80% da velocity pra deixar buffer)

### Backlog do Sprint

| ID | Story | SP | Responsável | Prioridade | Status |
|----|-------|----|-------------|------------|--------|
|    |       |    |             | P0/P1/P2   |        |

**Total comprometido:** [X] SP / [Y] SP capacidade

### Riscos e Dependências Conhecidas
- [risco externo]
- [dependência de outro time]

### Carryover do Sprint Anterior
- [item não concluído] — **motivo:** [...]
- [item não concluído] — **motivo:** [...]

### Fora do Sprint (backlog priorizado se sobrar tempo)
- [story opcional]
```

---

## Retrospectiva

```markdown
## Retro Sprint [N] — [YYYY-MM-DD]

### Sprint Goal foi atingido?
- [Sim / Parcialmente / Não] — [razão]

### Métricas do Sprint
- Velocity: [X] SP (planejado) → [Y] SP (entregue)
- Cycle time médio: [X] dias por story
- Carryover: [N] stories → [motivo agregado]
- Escaped defects: [N] bugs encontrados em prod após merge
- Deploy frequency: [N] deploys na semana

### O que foi bem 🟢
- [item concreto, não "trabalho em time"]

### O que pode melhorar 🟡
- [item específico com evidência]

### O que precisa mudar 🔴
- [problema recorrente que merece action]

### Action Items (máx 3, acionáveis)

| Ação | Dono | Prazo | Critério de sucesso |
|------|------|-------|---------------------|
|      |      |       |                     |

### Follow-up da retro anterior
- [Action item do sprint passado] — [Status: done / in progress / dropped]
```

---

## Épico → Stories Breakdown

Template pra quebrar épico grande em stories executáveis:

```markdown
## Épico: [Nome]

### Objetivo de negócio
[Outcome mensurável — métrica + target + prazo]

### User flow
1. [Passo do usuário]
2. [Passo do usuário]
3. ...

### Stories (ordem de entrega)

#### Sprint 1 — Base
- [ ] Story 1.1: [nome] — [SP]
- [ ] Story 1.2: [nome] — [SP]

#### Sprint 2 — MVP funcional
- [ ] Story 2.1: [nome] — [SP]
- [ ] Story 2.2: [nome] — [SP]

#### Sprint 3 — Polish + GA
- [ ] Story 3.1: [nome] — [SP]
- [ ] Story 3.2: [nome] — [SP]

### Critério de "épico pronto"
- [ ] Métrica X atingiu target Y
- [ ] Todas as stories P0 fechadas
- [ ] Feedback de ≥N usuários coletado

### Stories explicitamente fora do escopo (v2)
- [feature futura 1]
- [feature futura 2]
```

---

## Roadmap Trimestral (Now-Next-Later)

```markdown
## Roadmap Q[N] YYYY — [Tema do trimestre]

### Now (em execução — este sprint/próximo)
- [Épico A] — P0 — [outcome esperado]
- [Épico B] — P1 — [outcome esperado]

### Next (próximos 2-6 semanas — committed)
- [Épico C] — [outcome]
- [Épico D] — [outcome]

### Later (após 6 semanas — direcional, não committed)
- [Épico E]
- [Épico F]

### Explicitly NOT doing (diz não às coisas óbvias)
- [coisa que stakeholders pedem mas a gente rejeita]
- [coisa que parece importante mas não é]

### Gatilhos de re-priorização
- Se [métrica] não mover em [prazo], revisa Now
- Se [competidor] lançar [feature], revisa Next
```

---

## Antipatterns em PM

| Antipattern | Problema | Solução |
|---|---|---|
| Story "Melhorar performance" | Vago, não tem DoR | Métrica + baseline + target concreto |
| DoR fluido ("a gente vai vendo") | Stories entram sem critério, viram carryover | Checklist obrigatório antes de aceitar |
| Roadmap trimestral detalhado em tasks | Vira planejamento, não direção | Now-Next-Later com outcomes, não tasks |
| Retro sem action items | Retro vira desabafo | Máx 3 actions com dono + prazo |
| Velocity como metrica de perf | Gera gaming ("vou estimar tudo como 13") | Velocity é planning tool, não KPI |
| Carryover "zero tolerance" | Time esconde blocked | Carryover é informação — entenda a causa |
