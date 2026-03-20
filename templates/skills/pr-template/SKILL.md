---
name: pr-template
description: Template padronizado para Pull Requests — título, descrição, checklist de review e labels. Use quando criar ou revisar PRs.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# PR Template

Template padronizado para criar Pull Requests consistentes e review-friendly.

## Quando ativar

Ative quando o usuário estiver:
- Criando uma PR
- Pedindo para formatar descrição de PR
- Querendo um template de PR padronizado

## Template: PR Padrão

```markdown
## O que foi feito
<!-- Descreva as mudanças em bullets objetivos -->
-

## Por quê
<!-- Qual problema resolve ou qual feature entrega -->
-

## Como testar
<!-- Passos para validar as mudanças -->
1.
2.
3.

## Checklist
- [ ] Testes adicionados/atualizados
- [ ] Sem secrets hardcoded
- [ ] TypeScript sem erros (`npm run typecheck`)
- [ ] Lint passando (`npm run lint`)
- [ ] Migrations reversíveis (se aplicável)
- [ ] Documentação atualizada (se API pública mudou)
- [ ] PR com menos de 400 linhas (ou justificativa para mais)

## Screenshots (se UI)
<!-- Antes/depois se houver mudança visual -->

## Breaking changes
<!-- Liste breaking changes ou "Nenhum" -->
Nenhum
```

## Template: PR de Hotfix

```markdown
## Incidente
<!-- Link para o incidente/alerta -->
-

## Root cause
<!-- O que causou o problema -->
-

## Fix
<!-- O que foi feito para corrigir -->
-

## Como validar
1.

## Rollback plan
<!-- Como reverter se o fix causar problema -->
-

## Follow-up
<!-- Tasks para evitar recorrência -->
- [ ]
```

## Regras de título

- Formato: conventional commit em inglês
- Máximo 70 caracteres
- Exemplos:
  - `feat(auth): add Google OAuth2 login`
  - `fix(orders): resolve payment race condition`
  - `refactor(users): extract validation to shared util`
