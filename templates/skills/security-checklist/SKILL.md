---
name: security-checklist
description: Checklist de segurança pré-deploy — OWASP Top 10, headers, auth, secrets, dependências. Use antes de deploy ou review de segurança.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# Security Checklist

Checklist de segurança para validar antes de deploy ou em review de segurança.

## Quando ativar

Ative quando o usuário estiver:
- Preparando deploy para produção
- Fazendo review de segurança
- Auditando um módulo ou API
- Pedindo checklist de segurança

## Checklist: Pré-Deploy

### Autenticação e Autorização
- [ ] Endpoints protegidos com auth (JWT, session, API key)
- [ ] Autorização por role/permission verificada no backend (não só no frontend)
- [ ] Tokens com expiração adequada (access: 15min, refresh: 7d)
- [ ] Rate limiting em endpoints de login/register/forgot-password
- [ ] Logout invalida token/session no backend

### Input Validation
- [ ] Todos inputs validados no backend (Zod, class-validator, Pydantic)
- [ ] Queries parametrizadas (sem string concatenation)
- [ ] File upload: validação de tipo, tamanho e nome
- [ ] Sanitização de HTML/markdown (se renderizado)

### Secrets e Configuração
- [ ] Sem secrets no código (API keys, passwords, tokens)
- [ ] `.env` no `.gitignore`
- [ ] Secrets em secrets manager (AWS SSM, Azure Key Vault, GCP Secret Manager)
- [ ] Variáveis de ambiente diferentes por ambiente (dev/staging/prod)

### Headers e CORS
- [ ] CORS restrito aos domínios necessários (não `*` em APIs autenticadas)
- [ ] `Content-Security-Policy` configurado
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Strict-Transport-Security` (HSTS)
- [ ] `X-Frame-Options: DENY` (ou CSP frame-ancestors)

### Dependências
- [ ] `npm audit` / `pip audit` sem vulnerabilidades críticas
- [ ] Lockfile commitado (package-lock.json, yarn.lock)
- [ ] Dependências com versões fixas (não `^` ou `*` em produção)

### Database
- [ ] Migrations reversíveis
- [ ] Sem dados sensíveis em plaintext (passwords hashed com bcrypt/argon2)
- [ ] Backups configurados e testados
- [ ] Conexão via SSL

### Logging e Monitoring
- [ ] Sem PII em logs (email, CPF, cartão, senhas)
- [ ] Audit trail para ações críticas (login, pagamento, delete)
- [ ] Alertas configurados para erros 5xx e latência
- [ ] Error tracking (Sentry, Bugsnag)

### Infra
- [ ] HTTPS obrigatório (redirect HTTP → HTTPS)
- [ ] Firewall/security groups restritivos
- [ ] Containers rodando como non-root
- [ ] Imagens Docker com base slim e sem ferramentas de debug

## Comando rápido de auditoria

```bash
# Node.js
npm audit --production
npx eslint --config .eslintrc.js --rule '{"no-eval": "error"}' src/

# Buscar secrets no código
grep -rn "password\|secret\|api_key\|token" --include="*.ts" --include="*.js" src/ | grep -v node_modules | grep -v ".test."
```
