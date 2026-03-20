---
name: architecture-decision
description: Template de ADR (Architecture Decision Record) para documentar decisões técnicas com contexto, opções e trade-offs. Use quando tomar decisão de arquitetura.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# Architecture Decision Record (ADR)

Template para documentar decisões de arquitetura de forma estruturada e consultável.

## Quando ativar

Ative quando o usuário estiver:
- Tomando uma decisão técnica relevante (banco, framework, pattern)
- Documentando o porquê de uma escolha
- Precisando de template ADR
- Avaliando trade-offs entre opções

## Template: ADR Completo

```markdown
# ADR-[NNN]: [Título da decisão]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]
**Data:** YYYY-MM-DD
**Decisores:** [nomes]

## Contexto

[Qual problema estamos resolvendo? Quais são as restrições?]

## Decisão

[O que decidimos fazer]

## Opções avaliadas

### Opção A: [Nome]
**Prós:**
-

**Contras:**
-

**Custo estimado:** [tempo/dinheiro]

### Opção B: [Nome]
**Prós:**
-

**Contras:**
-

**Custo estimado:** [tempo/dinheiro]

## Justificativa

[Por que escolhemos a Opção X sobre as demais]

## Consequências

**Positivas:**
-

**Negativas:**
-

**Riscos:**
- [Risco] → [Mitigação]

## Referências

- [Links para docs, benchmarks, artigos]
```

## Template: ADR Rápido (lightweight)

```markdown
# ADR: [Título]

**Data:** YYYY-MM-DD | **Status:** Accepted

**Contexto:** [1-2 frases do problema]

**Decisão:** [O que decidimos]

**Alternativas descartadas:**
- [Opção B] — [motivo]
- [Opção C] — [motivo]

**Consequências:** [O que muda a partir de agora]
```

## Quando criar um ADR

- Escolha de banco de dados, ORM, framework
- Mudança de pattern (monolito → micro, REST → GraphQL)
- Decisão de infra (cloud provider, containerização)
- Mudança de estratégia de testes
- Adoção ou remoção de dependência crítica
- Qualquer decisão que alguém vai perguntar "por quê?" em 6 meses
