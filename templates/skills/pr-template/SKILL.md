---
name: pr-template
description: Template padronizado para Pull Requests — título, descrição, checklist de review e labels. Use quando criar ou revisar PRs.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# PR Template

Templates de PR estruturados pra facilitar review e reduzir fricção.
Versões: padrão, hotfix, refactor, revert, breaking change.

## Quando ativar

- Criando uma PR
- Formatando descrição de PR
- Querendo template padronizado
- Precisando de template específico (hotfix, revert, breaking change)

## Regras Universais

- **Título:** conventional commit em inglês, ≤70 chars, imperativo, lowercase
  - ✅ `feat(auth): add Google OAuth2 login`
  - ❌ `Added login` / `login feat` / `feat: added some stuff`
- **Body:** em português, direto ao ponto
- **PR size:** ≤400 linhas (diff). Maior exige justificativa no body
- **Link pra issue:** sempre referencie (`Closes #123`) pra auto-close

---

## Template: PR Padrão

```markdown
## O que foi feito
<!-- Bullets objetivos, 1-2 linhas cada -->
-

## Por quê
<!-- Problema que resolve ou feature que entrega. Link issue. -->
-

Closes #

## Como testar
<!-- Passos reproduzíveis -->
1.
2.
3.

## Screenshots / Vídeos
<!-- Antes/depois se UI muda. Demo curto se fluxo novo. -->

## Checklist

### Qualidade
- [ ] Testes adicionados/atualizados
- [ ] `npm run typecheck` passa (TypeScript sem erros)
- [ ] `npm run lint` passa
- [ ] Sem secrets hardcoded
- [ ] Sem `console.log` esquecido
- [ ] PR ≤400 linhas (ou justificativa)

### Segurança (se tocou auth, endpoint, dados)
- [ ] Input validation no backend
- [ ] Authorization guard correto
- [ ] Sem PII em logs
- [ ] Rate limit se endpoint sensível

### Banco (se tocou schema)
- [ ] Migration reversível
- [ ] Sem `ALTER TABLE ... SET NOT NULL` direto em tabela grande
- [ ] `CREATE INDEX CONCURRENTLY` em prod
- [ ] Plano de rollback documentado

### UI (se tocou frontend)
- [ ] A11y (labels, focus, contraste) verificada
- [ ] Responsivo 320px → desktop
- [ ] Estados: loading, empty, error, success
- [ ] Dark mode (se aplicável)

### Observabilidade
- [ ] Logs estruturados com correlation ID
- [ ] Métrica de negócio instrumentada (se fluxo crítico)
- [ ] Alerta configurado para erro/latência

### Documentação
- [ ] README atualizado se comando/API mudou
- [ ] Changelog entrada adicionada
- [ ] ADR criado se decisão arquitetural

## Performance Impact
<!-- Mede antes e depois em cenários realistas -->
- Antes: [ex: P95 450ms, 12 queries por request]
- Depois: [ex: P95 180ms, 3 queries por request]
- Como medi: [profiler, k6, EXPLAIN ANALYZE]

## Breaking Changes
<!-- Nenhum OU detalhe impacto e migração -->
Nenhum
```

---

## Template: PR de Hotfix

```markdown
## Incidente
<!-- Link: PagerDuty, Sentry, ticket -->
-

## Root cause
<!-- Uma causa raiz, não "várias coisas" -->
-

## Fix
<!-- Mínimo viável. Não aproveita pra refatorar. -->
-

## Como validar
1. Reprodução local do incidente
2. Fix aplicado → reprodução não dispara mais
3. Teste de regressão incluído

## Rollback plan
<!-- Como reverter em <5min se fix causar problema -->
-

## Follow-up (post-incident)
- [ ] Postmortem agendado
- [ ] Teste que previne regressão
- [ ] Monitoramento adicional (se detecção foi tardia)
- [ ] Issue pra fix estrutural (se houver)
```

---

## Template: PR de Refactor

```markdown
## O que foi refatorado
-

## Por quê agora
<!-- Refactor precisa de trigger: bug recorrente, feature bloqueada, tech debt crítico -->
-

## Equivalência funcional
<!-- Comportamento observável não muda — como você garantiu? -->
- [ ] Testes existentes continuam passando
- [ ] Cobertura não caiu
- [ ] Comportamento manual idêntico (gravei antes/depois se UI)

## O que fica melhor
- [ex: menos acoplamento, mais testável, menor cognitive load]

## O que fica pior (honestidade)
- [ex: mais arquivos, indireção adicional, dep nova]

## Migração
<!-- Outros módulos precisam mudar? Quando? -->
- Nenhuma OU [descrição]
```

---

## Template: PR Breaking Change

```markdown
## Breaking Change: [API / contrato / comportamento]

## O que mudou
- Antes: [interface antiga]
- Depois: [interface nova]

## Por quê
<!-- Motivo forte — compliance, bug estrutural, limite de escala -->
-

## Impacto
- Clientes afetados: [lista de consumidores]
- Ações necessárias por cliente:
  - [Cliente A]: atualizar SDK para v2.x
  - [Cliente B]: nenhuma (usa endpoint antigo que ficará)

## Período de transição
- v1 ativa até: [data]
- Warning header (`Deprecation: true`) desde: [data]
- Removido em: [versão]

## Como comunicar
- [ ] Email para stakeholders enviado
- [ ] Changelog com guia de migração
- [ ] Doc de upgrade em /docs/migration-vX-to-vY.md
- [ ] Canal #api-announcements notificado
```

---

## Template: PR de Revert

```markdown
## Revertido: [título do PR original] (#NNN)

## Motivo
<!-- Seja específico. "Causou erro em X sob condição Y." -->
-

## Evidência
<!-- Log, métrica, trace do Sentry mostrando o impacto -->
-

## Próximos passos
- [ ] Root cause documentado em #NNNN
- [ ] Novo PR com fix + testes que previnem a regressão
- [ ] Postmortem se o revert foi durante incidente

## Impacto do revert
- [ ] Dados persistidos sob lógica nova: [plano pra corrigir]
- [ ] Features lançadas que dependiam: [comunicação]
```

---

## Anti-patterns em PRs

| Anti-pattern | Por que é problema | Como evitar |
|---|---|---|
| PR >1000 linhas | Review impossível, bugs passam | Split por commit atômico ou feature flag |
| Commit "wip" ou "fix stuff" | Histórico inútil | Squash antes de merge OU commits atômicos |
| Sem descrição | Reviewer tem que adivinhar | Use o template — mesmo que curto |
| "Como testar: siga o que fiz" | Não-reproduzível | Steps numerados, comando exato |
| Refactor + feature no mesmo PR | Review pesado, rollback complexo | 2 PRs: refactor primeiro, feature depois |
| Breaking change sem aviso | Consumidores quebrados em prod | Template de breaking change + comunicação |
| Testes "depois" em TODO | Nunca chega | Teste no mesmo PR ou bloqueia merge |
