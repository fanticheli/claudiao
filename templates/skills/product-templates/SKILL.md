---
name: product-templates
description: Templates prontos para PRD, RICE scoring, product brief e go-to-market. Use quando precisar documentar decisões de produto.
allowed-tools: Read, Write, Edit, AskUserQuestion
model: sonnet
---

# Product Templates

Templates de produto com raciocínio embutido. Não são apenas tabelas —
cada template inclui narrativa, justificativa e gatilhos de revisita,
porque decisão de produto sem "por quê" envelhece mal.

## Quando ativar

- Criando PRD ou product brief para uma feature
- Priorizando backlog com frameworks (RICE, WSJF)
- Definindo MVP e escopo
- Planejando go-to-market
- Documentando hipótese antes de discovery

## Princípios

1. **Hipótese antes de solução.** Sempre articule o problema e a aposta
   antes de descrever features.
2. **Baseline + Target + Prazo** em toda métrica. Sem isso, não dá pra
   declarar sucesso ou falha.
3. **Fora de escopo é tão importante quanto escopo.** Previne 80% das
   discussões em refinamento.
4. **RICE sem narrativa é ansiedade numerada.** Toda priorização tem
   contexto — documente.

---

## Product Brief / PRD

```markdown
# [Nome da Feature]

**Autor:** [nome]  **Status:** Discovery | Ready | Shipped  **Atualizado:** YYYY-MM-DD

## Problema

[Qual dor do usuário? Quais evidências?]

**Evidências:**
- [Dado quantitativo: nº de tickets, % de drop, NPS driver]
- [Dado qualitativo: citação de entrevista, feedback gravado]
- [Concorrência/benchmark, se relevante]

## Hipótese

Acreditamos que **[solução]** para **[persona]** vai resultar em
**[outcome mensurável]**.

Saberemos que temos sucesso quando **[métrica-chave]** mudar de
**[baseline]** para **[target]** em **[prazo]**.

## Escopo MVP

### Inclui
- [item 1 — com critério de aceite claro]
- [item 2]

### Não inclui (v2)
- [item futuro 1 — motivo do corte]
- [item futuro 2]

### Explicitamente rejeitado
- [coisa que alguém vai pedir e a resposta é "não"] — [motivo]

## Métricas de Sucesso

| Métrica | Baseline | Target | Prazo | Fonte |
|---------|----------|--------|-------|-------|
| [leading] | | | | [onde medir] |
| [lagging] | | | | [dashboard] |

> **Regra**: toda feature precisa de 1 métrica leading (comportamento
> imediato) + 1 lagging (impacto no negócio).

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| [risco técnico] | Alta/Média/Baixa | A/M/B | [ação] |
| [risco de adoção] | | | |
| [risco regulatório] | | | |

## Dependências

- [dependência técnica — time X entregar Y até Z]
- [dependência externa — integração com parceiro]
- [aprovações necessárias — legal, segurança]

## Timeline

| Fase | Data | Entregável |
|------|------|-----------|
| Discovery | | Entrevistas + validação da hipótese |
| Design | | Mockups + fluxo aprovado |
| MVP dev | | Release interno |
| Beta (10%) | | Métricas validadas com amostra |
| GA | | 100% rollout |

## Decisão de Kill/Continue

Após [prazo], se [métrica] não atingir [threshold]:
- [ ] Kill (arquivar e documentar aprendizado)
- [ ] Pivot (mudar hipótese)
- [ ] Continue (investir mais)
```

---

## RICE Scoring — com Narrativa

RICE puro (tabela de números) é fácil de manipular. Sempre documente
raciocínio por feature e gatilhos de revisita.

```markdown
## Priorização RICE — [Contexto / Trimestre]

### Sumário

| # | Feature | Reach | Impact | Conf | Effort | RICE | P |
|---|---------|------:|-------:|-----:|-------:|-----:|---|
| 1 | [nome] | 800 | 1.0 | 90% | 1 pw | **720** | 🥇 |
| 2 | [nome] | 1200 | 2.0 | 50% | 6 pw | **200** | 🥈 |
| 3 | [nome] | 150 | 3.0 | 40% | 10 pw | **18** | 🥉 |

**Fórmula:** RICE = (Reach × Impact × Confidence) / Effort
**Escala Impact:** 0.25 (mínimo) | 0.5 (baixo) | 1 (médio) | 2 (alto) | 3 (massivo)
**Confidence:** 100% = dado concreto | 80% = feedback forte | 50% = hipótese razoável | 20% = chute

---

### Raciocínio por Feature

#### 1. [Feature] — RICE [score]

- **Reach:** [número] por trimestre. [Como foi calculado. Que % da base.]
- **Impact:** [escala]. [Que comportamento muda. Qual métrica move.]
- **Confidence:** [%]. [Base na confiança — feedback, dado, pesquisa.]
- **Effort:** [pw]. [Breakdown: backend X pw, frontend Y pw, QA Z pw.]
- **Veredicto:** [o que isso significa na prática — low-hanging fruit?
  aposta? requer discovery?]
- **Gatilho pra revisitar:** [condição que muda o score — ex: se Reach
  dobrar, vira P0]

#### 2. [Feature] — RICE [score]
(mesma estrutura)

#### 3. [Feature] — RICE [score]
(mesma estrutura)

---

### Recomendação

1. **Sprint atual:** [feature 1] — [motivo curto]
2. **Paralelo:** [discovery / pesquisa / validação pra feature 2]
3. **Próximo ciclo:** [feature 2] se [condição]; caso contrário [alternativa]
4. **Backlog com gatilho:** [feature 3] — só executar quando [trigger]

### Anti-patterns evitados

- Não construir antes de validar (feature com Confidence <50%)
- Não confundir Reach (volume) com Impact (intensidade)
- Não inflar Effort pra justificar priorização
- Não somar RICE de features inter-dependentes (some o effort, não o score)
```

---

## Feature Discovery Brief

Antes de priorizar, valide se a feature resolve problema real.

```markdown
## Discovery — [Feature]

**Objetivo:** validar se [feature] resolve [problema] para [persona].
**Prazo:** [X semanas]  **Budget:** [Y horas]

### Hipótese a Validar

[Acreditamos que X vai acontecer porque Y.]

### Plano de Investigação

- [ ] 5 entrevistas com [persona] — foco em [pergunta principal]
- [ ] Análise de dados: [query / dashboard] pra confirmar [sinal]
- [ ] Protótipo clickable (Figma) testado com 3 usuários
- [ ] Benchmark de 3 concorrentes

### Perguntas-Chave (entrevistas)

1. Me conta a última vez que você [tentou X]. O que aconteceu?
2. Que workaround você usa hoje?
3. Se isso não existisse, o que aconteceria?
4. Se eu te desse [feature], o que você faria primeiro?
5. [pergunta específica do contexto]

### Critérios de Decisão

**Go** se:
- ≥4 de 5 entrevistados confirmam a dor com exemplo concreto
- Dado quantitativo mostra [sinal X]
- Esforço estimado <= [Y pw]

**Kill** se:
- Dor existe mas é ocasional (<1x/mês)
- Workaround atual é "bom o suficiente"
- Problema é de awareness (marketing), não de produto
```

---

## Go-to-Market Checklist

```markdown
## GTM — [Feature]

**Data alvo:** YYYY-MM-DD  **Tipo:** Novidade | Update | Beta pública

### Pré-lançamento (T-2 semanas)

- [ ] Feature flag configurada e testada em staging
- [ ] Docs atualizados: help center, API reference, changelog
- [ ] Landing page / post de blog (se publicize)
- [ ] Comunicação interna: CS, vendas, suporte alinhados
- [ ] Rollout plan definido: 5% → 25% → 50% → 100%
- [ ] Kill switch testado (volta tudo em <5min)
- [ ] Dashboard de monitoramento criado

### Lançamento (T-0)

- [ ] Deploy em produção
- [ ] Feature flag aberta pra grupo beta (5% ou clientes específicos)
- [ ] Anúncio em canais apropriados (Slack interno, email, in-app)
- [ ] Equipe on-call por 4h após rollout
- [ ] Métricas sendo coletadas corretamente (validar)

### Pós-lançamento (T+7 dias)

- [ ] Análise de métricas vs target do PRD
- [ ] Feedback coletado (support tickets, NPS, entrevistas rápidas)
- [ ] Bugs reportados triados e priorizados
- [ ] Decisão: expandir rollout, iterar, ou rollback

### Pós-lançamento (T+30 dias)

- [ ] Revisão de sucesso: métrica bateu target?
- [ ] Retrospectiva: o que aprendemos?
- [ ] Roadmap ajustado com próximas iterações (ou kill documentado)
```

---

## Antipadrões em Product Docs

| Antipadrão | Por que é problema | Como evitar |
|---|---|---|
| "Deixa eu justificar com RICE" depois de já escolher | Priorização vira teatro | Roda RICE antes de defender a feature |
| Métrica sem baseline | Não dá pra declarar sucesso | Meça **antes** de construir |
| Escopo MVP crescendo no refinamento | "Só mais isso" = 3 meses atrasado | Seção "não inclui" assinada por stakeholders |
| PRD de 10 páginas sem hipótese clara | Documenta solução, não problema | Uma frase de hipótese no topo |
| Features sem dono após GA | Tech debt se acumula | GTM tem "dono pós-lançamento" explícito |
| Kill criteria vago ("se não funcionar…") | Feature zumbi sobrevive indefinido | Threshold numérico + data fixa |
