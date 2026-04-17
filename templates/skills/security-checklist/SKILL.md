---
name: security-checklist
description: Checklist de segurança pré-deploy — OWASP Top 10, headers, auth, secrets, dependências. Use antes de deploy ou review de segurança.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# Security Checklist

Checklist de segurança acionável. Cada item cita CWE/OWASP quando aplicável
pra você rastrear em ferramentas de SAST/DAST.

## Quando ativar

- Preparando deploy para produção
- Fazendo review de segurança
- Auditando módulo ou API
- Finalizando endpoint público novo
- Antes de expor integração para terceiro

## Mapa OWASP Top 10 (2021) → onde checar no código

| OWASP | Nome | Onde tipicamente aparece |
|---|---|---|
| A01 | Broken Access Control | Controllers/guards sem ownership check |
| A02 | Cryptographic Failures | Senhas em plaintext, TLS opcional, secrets fracos |
| A03 | Injection | SQL concatenado, `eval`, comandos shell com input |
| A04 | Insecure Design | Falta rate limit, falta auth em endpoint sensível |
| A05 | Security Misconfiguration | Docker root, debug mode em prod, headers ausentes |
| A06 | Vulnerable Components | `npm audit`/`pip audit` sem revisão |
| A07 | Auth Failures | Token sem expiração, login sem throttle, senha fraca |
| A08 | Software Integrity Failures | CI/CD sem signing, deps de fonte não confiável |
| A09 | Logging & Monitoring Failures | Sem audit trail, PII em log |
| A10 | SSRF | Fetch de URL vinda do user sem allowlist |

---

## Checklist: Pré-Deploy

### Autenticação e Autorização

- [ ] Endpoints protegidos com auth (JWT, session, API key) — **A01/A07**
- [ ] Autorização por role/permission verificada no backend, não só no frontend — **A01**
- [ ] **Ownership check**: `resource.owner_id === user.id` em `/api/resource/:id` — **A01 (IDOR / CWE-639)**
- [ ] Tokens com expiração adequada — access: 15min, refresh: 7d — **CWE-613**
- [ ] Rate limiting em `/auth/login`, `/auth/register`, `/auth/forgot` (5 req/min) — **A07**
- [ ] Logout invalida token/session no backend (blacklist ou JTI versionado)
- [ ] **MFA obrigatório** para admins e ações críticas (delete account, rotate key)
- [ ] Refresh token rotation (token antigo invalidado após uso) — **CWE-287**

### Input Validation — A03

- [ ] Todo input validado no backend (Zod, class-validator, Pydantic)
- [ ] Validação **por schema**, não `if (x === null)` espalhado
- [ ] Queries parametrizadas — **nunca** concatenar string em SQL
- [ ] `eval`, `Function()`, `exec` — zero uso com input externo
- [ ] Comandos shell via `spawn([args])`, nunca `exec('cmd ' + input)` — **CWE-78**
- [ ] File upload valida: tipo (magic bytes, não só extension), tamanho, nome (path traversal)
- [ ] Sanitização de HTML/markdown se renderizado (DOMPurify, bleach)

### Secrets e Configuração — A02/A05

- [ ] Sem secrets no código (API keys, passwords, tokens, JWT secrets)
- [ ] `.env`, `.env.local`, `.env.*.local` no `.gitignore`
- [ ] Secrets em secrets manager (AWS SSM, Azure Key Vault, GCP Secret Manager)
- [ ] Variáveis diferentes por ambiente (dev/staging/prod)
- [ ] **Rotação documentada** pra JWT_SECRET, DB password, API keys terceiros
- [ ] Git history limpo de secrets antigos (`trufflehog`, `git-secrets`)

### Headers e CORS — A05

- [ ] CORS restrito por allowlist (nunca `*` em API autenticada)
- [ ] `Content-Security-Policy` configurado (pelo menos `default-src 'self'`)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `X-Frame-Options: DENY` ou CSP `frame-ancestors 'none'`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` desabilitando features não usadas (camera, mic, geolocation)

### Dependências — A06

- [ ] `npm audit --production` / `pip audit` sem high/critical
- [ ] Lockfile commitado (package-lock.json, yarn.lock, uv.lock)
- [ ] **Dependabot/Renovate** ativo no repo
- [ ] Deps de fontes oficiais (npm, PyPI) — zero `git+ssh://` ou tarball random
- [ ] Revisa deps que foram adicionadas nos últimos 6 meses (supply chain fresh risk)

### Database — A02

- [ ] Migrations reversíveis
- [ ] Senhas com bcrypt/argon2 (nunca SHA256 puro) — **CWE-916**
- [ ] Backups configurados, **restauração testada** (backup não testado = backup inexistente)
- [ ] Conexão via SSL/TLS (verify-full em prod)
- [ ] **Row-Level Security** em tabelas multi-tenant (última linha de defesa)
- [ ] Acesso ao banco via credenciais rotacionadas (IAM auth em RDS, se possível)

### Logging e Monitoring — A09

- [ ] Sem PII em logs (email, CPF, CVV, cartão, token) — **redact automático**
- [ ] Audit trail para ações críticas (login, pagamento, delete, rotate key)
- [ ] Alertas configurados para 5xx > 1%, latência P95 > threshold
- [ ] Error tracking (Sentry, Bugsnag) com `beforeSend` removendo PII
- [ ] Correlation ID em todo log (rastreia request end-to-end)
- [ ] **Detecção de enumeração**: alerta em N logins falhos diferentes por IP/hora

### Infra — A05

- [ ] HTTPS obrigatório (HTTP → HTTPS redirect, HSTS)
- [ ] Firewall/security groups com princípio de menor privilégio
- [ ] Containers rodando como **non-root** (`USER node` no Dockerfile)
- [ ] Imagens Docker com base slim (`node:20-alpine`, `python:3.12-slim`)
- [ ] **Sem ferramentas de debug em prod** (`curl`, `netcat`, shell interativo)
- [ ] Read-only filesystem onde possível
- [ ] Resource limits definidos (CPU, memória) — previne DoS interno

### SSRF e Fetches Externos — A10

- [ ] URLs vindas do user validadas contra allowlist de hosts
- [ ] Bloqueio de IPs privados (127.0.0.1, 10.0.0.0/8, 169.254.169.254)
- [ ] Timeout configurado em todo HTTP client (default infinito = DoS)
- [ ] Response size limitada (evita download de GB por bug/abuse)

---

## Por Stack: Checks Adicionais

### Node.js / NestJS

- [ ] `helmet()` aplicado no bootstrap
- [ ] `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` global
- [ ] `@Throttle()` em endpoints auth
- [ ] Não expor stack traces em produção (`app.useGlobalFilters(new AllExceptionsFilter())`)
- [ ] `pino` com redact: `['req.headers.authorization', 'req.body.password']`

### Python / FastAPI

- [ ] `CORSMiddleware` com origins explícito
- [ ] `SecretStr` (Pydantic) nos secrets — evita logging acidental
- [ ] `Depends` com auth em todo endpoint protegido
- [ ] SQLAlchemy com queries parametrizadas (ORM default está ok; `text()` requer cuidado)
- [ ] `python-jose` ou `authlib` atualizados — libs de JWT têm histórico de CVE

### AWS / Fargate

- [ ] Task role com policy mínima (nunca `*:*`)
- [ ] Secrets injetados via `secrets` block na task definition (ARN do Secrets Manager)
- [ ] Security Group ingress: só do ALB (não `0.0.0.0/0`)
- [ ] Container em subnet privada (sem IP público)
- [ ] WAF habilitado se exposto publicamente
- [ ] GuardDuty + CloudTrail ligados

---

## Comandos Rápidos de Auditoria

```bash
# Node.js
npm audit --production --omit=dev
npx better-npm-audit audit
# Buscar secrets no código
grep -rnE "(password|secret|api_key|token)\s*[:=]\s*['\"]" \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=dist src/

# Python
pip-audit
bandit -r src/
detect-secrets scan --baseline .secrets.baseline

# Docker
trivy image my-image:latest
docker scout quickview

# Git history (secrets já vazados)
trufflehog git file://. --only-verified

# Headers em produção (rodar contra staging/prod)
curl -sI https://api.example.com | grep -iE "strict-transport|content-security|x-frame"
```

---

## Red Flags Instantâneos (flagra imediato em review)

- `process.env.X` usado sem `ConfigService` ou wrapper
- `catch {}` em operação que toca dados sensíveis
- `jwt.sign(payload, 'hardcoded-secret')`
- `WHERE email = '${email}'` em query
- `res.send(req.query.html)` sem sanitização
- `dangerouslySetInnerHTML` sem DOMPurify
- `cors({ origin: '*', credentials: true })` em API autenticada
- `RUN chmod 777 /app` no Dockerfile
- `console.log(user)` em handler de login
