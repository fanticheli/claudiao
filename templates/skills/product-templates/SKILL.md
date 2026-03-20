---
name: product-templates
description: Templates prontos para PRD, RICE scoring, product brief e go-to-market. Use quando precisar documentar decisões de produto.
allowed-tools: Read, Write, Edit, AskUserQuestion
model: sonnet
---

# Product Templates

Templates prontos para documentação de produto.

## Quando ativar

Ative quando o usuário estiver:
- Criando PRD ou product brief para uma feature
- Priorizando backlog com frameworks (RICE, WSJF)
- Definindo MVP e escopo
- Planejando go-to-market

## Templates

### Product Brief / PRD

```markdown
# [Nome da Feature]

## Problema
[Qual dor do usuário? Quais evidências (dados, feedback, pesquisa)?]

## Hipótese
Acreditamos que [solução] para [persona] vai resultar em [outcome].
Saberemos que temos sucesso quando [métrica] mudar de [baseline] para [target].

## Escopo MVP
### Inclui
- [item 1]
- [item 2]

### Não inclui (v2)
- [item futuro 1]
- [item futuro 2]

## Métricas de Sucesso
| Métrica | Baseline | Target | Prazo |
|---------|----------|--------|-------|
|         |          |        |       |

## Riscos
| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
|       |              |         |           |

## Dependências
- [dependência técnica ou de time]

## Timeline
- Discovery: [data]
- MVP: [data]
- GA: [data]
```

### RICE Scoring

```markdown
## Priorização RICE

| Feature | Reach (users/quarter) | Impact (0.25-3) | Confidence (%) | Effort (person-weeks) | RICE Score | Priority |
|---------|----------------------|------------------|----------------|----------------------|------------|----------|
|         |                      |                  |                |                      |            |          |

**Fórmula**: RICE = (Reach × Impact × Confidence) / Effort

**Escala de Impact**: 0.25 (mínimo) | 0.5 (baixo) | 1 (médio) | 2 (alto) | 3 (massivo)
```

### Go-to-Market Checklist

```markdown
## GTM Checklist — [Feature]

### Pré-lançamento
- [ ] Feature flag configurada
- [ ] Docs/help center atualizados
- [ ] Changelog preparado
- [ ] Comunicação interna (time CS, vendas)
- [ ] Rollout plan definido (% de usuários)

### Lançamento
- [ ] Feature flag aberta para grupo beta
- [ ] Métricas de monitoramento ativas
- [ ] Canal de feedback aberto

### Pós-lançamento
- [ ] Análise de métricas (7 dias)
- [ ] Feedback coletado e triado
- [ ] Decisão: expandir, iterar, ou rollback
```
