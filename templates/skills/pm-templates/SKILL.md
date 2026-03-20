---
name: pm-templates
description: Templates para gestão de projetos — user stories, ADRs, sprint planning, retrospectivas e roadmaps. Use quando precisar criar artifacts de PM.
allowed-tools: Read, Write, Edit, AskUserQuestion
model: sonnet
---

# Project Management Templates

Templates prontos para artifacts de gestão de projetos.

## Quando ativar

Ative quando o usuário estiver:
- Escrevendo user stories ou critérios de aceitação
- Documentando decisões arquiteturais (ADR)
- Planejando sprint ou roadmap
- Facilitando retrospectiva

## Templates

### User Story

```markdown
## [ID] — [Título curto]

**Como** [persona],
**Eu quero** [ação],
**Para que** [benefício/valor de negócio].

### Critérios de Aceitação
- [ ] Dado [contexto], quando [ação], então [resultado esperado]
- [ ] Dado [contexto], quando [ação], então [resultado esperado]

### Notas Técnicas
- [decisões de implementação, dependências, riscos]

### Estimativa
- Story Points: [X]
- T-Shirt: [S/M/L/XL]
```

### ADR (Architecture Decision Record)

```markdown
# ADR-XXX: [Título da Decisão]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-YYY]

## Contexto
[Qual problema estamos resolvendo? Quais constraints existem?]

## Decisão
[O que decidimos fazer e por quê.]

## Consequências

### Positivas
- [benefício 1]

### Negativas
- [trade-off 1]

### Neutras
- [implicação 1]

## Alternativas Consideradas

### [Alternativa A]
- Prós: ...
- Contras: ...
- Motivo da rejeição: ...
```

### Sprint Planning

```markdown
## Sprint [N] — [data início] a [data fim]

### Sprint Goal
[Objetivo único e claro do sprint]

### Capacidade
- Devs disponíveis: [N]
- Dias úteis: [N]
- Velocity média (últimos 3 sprints): [X] SP
- Capacidade estimada: [X] SP

### Backlog do Sprint
| ID | Story | SP | Responsável | Status |
|----|-------|----|-------------|--------|
|    |       |    |             |        |

**Total**: [X] SP / [X] SP capacidade

### Riscos e Dependências
- [risco/dependência]

### Carryover do Sprint Anterior
- [item não concluído e motivo]
```

### Retrospectiva

```markdown
## Retro Sprint [N] — [data]

### O que foi bem
- [item]

### O que pode melhorar
- [item]

### Action Items
| Ação | Responsável | Prazo | Status |
|------|-------------|-------|--------|
|      |             |       |        |

### Métricas do Sprint
- Velocity: [X] SP
- Cycle Time médio: [X] dias
- Carryover: [N] stories
- Escaped defects: [N]
```
