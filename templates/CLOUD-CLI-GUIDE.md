# Guia: Cloud Specialists + CLI Direto

Como conectar o Claude Code diretamente nas suas clouds via CLI para validar arquitetura, investigar erros, analisar logs e operar infraestrutura — tudo conversando em linguagem natural.

> **Este é o caso de uso mais poderoso do toolkit.** Você conecta a CLI da cloud, e o Claude Code vira seu copiloto de infra — roda comandos reais, interpreta outputs, e te guia em troubleshooting ao vivo.

---

## Como funciona

```
Você: "por que o ECS task tá reiniciando?"
  │
  ▼
Claude Code detecta contexto de AWS
  │
  ▼
aws-specialist é invocado automaticamente
  │
  ▼
Roda: aws ecs describe-tasks, aws logs tail, aws cloudwatch get-metric-data...
  │
  ▼
Analisa os outputs e te dá o diagnóstico + sugestão de fix
```

Os cloud specialists (`aws-specialist`, `gcp-specialist`, `azure-specialist`) têm acesso à ferramenta **Bash**, o que significa que podem executar qualquer comando CLI da cloud. A única coisa que você precisa garantir é que a CLI esteja autenticada.

---

## 1. Setup: Autenticação das CLIs

### AWS — SSO Login

```bash
# 1. Instale a AWS CLI v2
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# 2. Configure o SSO (uma vez)
aws configure sso
# Preencha: SSO start URL, região, account ID, role name
# Isso cria um profile em ~/.aws/config

# 3. Faça login (dura ~8h, repita quando expirar)
aws sso login --profile meu-profile

# 4. Exporte o profile pra sessão (IMPORTANTE — sem isso o Claude não sabe qual profile usar)
export AWS_PROFILE=meu-profile

# 5. Teste
aws sts get-caller-identity
```

**Dica pro dia a dia:** adicione no seu `.bashrc` / `.zshrc`:

```bash
# Profile padrão pra AWS SSO
export AWS_PROFILE=meu-profile

# Alias pra login rápido
alias awslogin='aws sso login --profile meu-profile'
```

### GCP — gcloud Auth

```bash
# 1. Instale o gcloud CLI
# https://cloud.google.com/sdk/docs/install

# 2. Faça login (abre o browser)
gcloud auth login

# 3. Configure o projeto padrão
gcloud config set project meu-projeto-id

# 4. Autentique as credenciais de aplicação (necessário pra algumas APIs)
gcloud auth application-default login

# 5. Teste
gcloud config list
gcloud projects describe meu-projeto-id
```

**Dica pro dia a dia:** configure múltiplos projetos com `gcloud config configurations`:

```bash
# Crie configurações nomeadas
gcloud config configurations create producao
gcloud config set project meu-projeto-prod
gcloud config set compute/region us-east1

gcloud config configurations create staging
gcloud config set project meu-projeto-staging
gcloud config set compute/region us-east1

# Troque entre elas
gcloud config configurations activate producao
```

### Azure — az login

```bash
# 1. Instale o Azure CLI
# https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

# 2. Faça login (abre o browser)
az login

# 3. Selecione a subscription
az account set --subscription "minha-subscription-id"

# 4. Teste
az account show
```

**Dica pro dia a dia:** para múltiplas subscriptions:

```bash
# Liste subscriptions
az account list --output table

# Troque rápido
alias azprod='az account set --subscription "prod-sub-id"'
alias azstaging='az account set --subscription "staging-sub-id"'
```

### Multi-cloud: todas conectadas ao mesmo tempo

Você pode ter AWS, GCP e Azure autenticadas simultaneamente. O Claude Code usa o specialist correto baseado no contexto:

```bash
# Conecte tudo antes de abrir o Claude Code
aws sso login --profile meu-profile
gcloud auth login
az login

# Abra o Claude Code
claude
```

---

## 2. Permissões do Claude Code

Quando o Claude Code roda um comando CLI pela primeira vez, ele pede sua permissão. Você pode:

- **Aprovar caso a caso** — mais seguro, recomendado no início
- **Aprovar por sessão** — aprova uma vez e vale até fechar
- **Configurar permissões automáticas** — pra comandos read-only que você usa sempre

### Permissões recomendadas (read-only seguras)

Se você quer que o Claude rode comandos de leitura sem perguntar toda vez, configure em `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(aws sts *)",
      "Bash(aws ecs describe-*)",
      "Bash(aws ecs list-*)",
      "Bash(aws logs *)",
      "Bash(aws cloudwatch *)",
      "Bash(aws rds describe-*)",
      "Bash(aws s3 ls *)",
      "Bash(aws ec2 describe-*)",
      "Bash(aws iam list-*)",
      "Bash(aws iam get-*)",
      "Bash(aws lambda list-*)",
      "Bash(aws lambda get-*)",
      "Bash(gcloud *)",
      "Bash(az *)"
    ]
  }
}
```

> **Atenção:** NUNCA adicione permissões de escrita/delete automáticas (ex: `aws ecs update-*`, `gcloud run deploy`, `az webapp delete`). Operações destrutivas devem sempre pedir confirmação.

---

## 3. Casos de uso reais

### Troubleshooting: "por que tá dando erro?"

```bash
# Situação: task do ECS reiniciando
você: O serviço orders-api no ECS tá com tasks reiniciando a cada 5 minutos.
      Investiga o que tá acontecendo.

# O Claude Code (via aws-specialist) vai:
# 1. aws ecs describe-services → ver status e desired/running count
# 2. aws ecs describe-tasks → ver stopped reason
# 3. aws logs tail → pegar os últimos logs do container
# 4. aws cloudwatch get-metric-data → ver CPU/memory
# 5. Te dar o diagnóstico: "OOM kill — container usando 480MB com limit de 512MB"
# 6. Sugerir: "aumente memoryReservation pra 1024 no task definition"
```

```bash
# Situação: Cloud Run retornando 503
você: O serviço de auth no Cloud Run tá retornando 503 intermitente.
      Olha os logs e descobre o que tá acontecendo.

# O Claude Code (via gcp-specialist) vai:
# 1. gcloud run services describe → ver config e status
# 2. gcloud logging read → filtrar logs de erro
# 3. gcloud run revisions list → ver se tem revisão falhando
# 4. Diagnóstico: "cold start de 8s + timeout de 10s = 503 em picos"
# 5. Sugestão: "configure min-instances=1 e aumente timeout pra 30s"
```

### Validação de arquitetura: "tá configurado certo?"

```bash
# Validar security groups
você: Valida os security groups do RDS de produção.
      Tem alguma porta exposta que não deveria?

# O Claude Code vai:
# 1. aws rds describe-db-instances → pegar o SG associado
# 2. aws ec2 describe-security-groups → listar regras de ingress/egress
# 3. Análise: "porta 5432 aberta pra 0.0.0.0/0 — CRÍTICO"
# 4. Fix: "restrinja pra CIDR do VPC: 10.0.0.0/16"
```

```bash
# Verificar IAM
você: Lista as permissões da role do ECS task e diz se tem alguma
      permissão excessiva (princípio do least privilege).

# O Claude Code vai:
# 1. aws iam list-attached-role-policies
# 2. aws iam get-policy → pegar o policy document de cada uma
# 3. Análise: "tem AmazonS3FullAccess — deveria ter apenas s3:GetObject no bucket específico"
```

### Análise de custos: "quanto tá custando?"

```bash
# Breakdown de custos
você: Pega o custo dos últimos 30 dias por serviço e me diz onde tá
      o maior gasto e o que posso otimizar.

# O Claude Code vai:
# 1. aws ce get-cost-and-usage → custo por serviço
# 2. Análise: "RDS: $450/mês (63%) — db.r5.xlarge rodando 24/7"
# 3. Sugestão: "considere Reserved Instance (economia de ~40%) ou
#    Aurora Serverless v2 se o workload é variável"
```

### Análise de logs: "o que aconteceu?"

```bash
# Filtrar logs por padrão
você: Busca nos logs do CloudWatch do serviço payments-api
      todas as ocorrências de "timeout" nas últimas 2 horas.
      Agrupa por endpoint e me diz qual tá pior.

# O Claude Code vai:
# 1. aws logs filter-log-events com pattern "timeout"
# 2. Agrupa e analisa: "POST /payments/process: 47 timeouts (89%)"
# 3. Sugestão: "investiga o downstream — pode ser o gateway de pagamento"
```

```bash
# BigQuery — analisar dados
você: Roda uma query no BigQuery pra ver os top 10 endpoints
      com maior latência p99 nas últimas 24h.

# O Claude Code vai:
# 1. bq query --use_legacy_sql=false 'SELECT ...'
# 2. Formata resultado em tabela
# 3. Analisa: "GET /api/reports/export tem p99 de 12s — provavelmente precisa de paginação"
```

### Operações guiadas: "me ajuda a fazer X"

```bash
# Deploy guiado
você: Preciso fazer deploy de uma nova versão do serviço users-api no ECS.
      Me guia passo a passo — quero entender cada etapa antes de executar.

# O Claude Code vai:
# 1. Mostrar a task definition atual
# 2. Explicar o que vai mudar
# 3. Pedir confirmação ANTES de cada comando destrutivo
# 4. Monitorar o deploy: aws ecs wait services-stable
# 5. Validar: aws ecs describe-services → running count == desired
```

```bash
# Criar recurso com IaC
você: Preciso de um bucket S3 pra armazenar uploads com:
      - Versionamento habilitado
      - Lifecycle: mover pra Glacier após 90 dias
      - Bloqueio de acesso público
      Gera o Terraform.

# O Claude Code vai:
# 1. Verificar se já existe infra Terraform no projeto
# 2. Seguir o padrão existente (module structure, naming)
# 3. Gerar o código Terraform completo
# 4. Sugerir: "rode terraform plan pra validar antes do apply"
```

---

## 4. Dicas avançadas

### Combine clouds num único pedido

```bash
você: Compara o custo de rodar nosso serviço de API (Node.js, 2 instâncias,
      4GB RAM, ~500k req/mês) na AWS (Fargate), GCP (Cloud Run) e Azure
      (Container Apps). Usa as CLIs pra pegar preços atuais se possível.
```

### Use ultrathink pra problemas complexos

```bash
você: Ultrathink: nosso serviço de pagamentos tá com latência crescente.
      Investiga usando CloudWatch metrics (CPU, memória, network),
      logs do ECS, e métricas do RDS. Correlaciona tudo e me dá
      o diagnóstico mais provável.
```

### Subagents em paralelo pra investigação multi-cloud

```bash
você: Use subagents em paralelo pra:
      1. Verificar saúde dos serviços ECS na AWS (cluster production)
      2. Verificar os Cloud Run services no GCP (projeto analytics)
      3. Verificar alarmes ativos no CloudWatch
      Consolida num status report.
```

### MCP Servers: superpoderes extras pra AWS

O `aws-specialist` tem acesso a dois MCP servers que ampliam suas capacidades:

| MCP Server | O que faz |
|------------|-----------|
| `mcp__aws-docs` | Busca e lê documentação oficial da AWS em tempo real |
| `mcp__aws-logs` | Roda CloudWatch Log Insights queries, analisa métricas e alarmes |

Isso significa que além dos comandos CLI, o Claude Code pode:

```bash
# Buscar na documentação oficial
você: Qual o limite de connections simultâneas do RDS PostgreSQL db.r5.large?
# → aws-specialist consulta a doc oficial via MCP e responde com source

# Rodar Log Insights queries
você: Roda uma query no CloudWatch Logs pra achar os erros mais
      frequentes do serviço orders-api na última hora.
# → Usa o MCP aws-logs pra rodar a query direto, sem precisar montar o JSON do CLI

# Verificar alarmes
você: Tem algum alarme disparando agora na minha conta AWS?
# → Usa o MCP pra listar alarmes ativos com contexto
```

Para configurar os MCP servers, consulte a documentação do Claude Code sobre [MCP servers](https://docs.anthropic.com/en/docs/claude-code/mcp).

---

## 5. Checklist: tá tudo pronto?

Antes de usar os cloud specialists com CLI direto, confirme:

- [ ] **AWS CLI v2** instalada (`aws --version`)
- [ ] **gcloud CLI** instalada (`gcloud --version`)
- [ ] **Azure CLI** instalada (`az --version`)
- [ ] **Login ativo** na(s) cloud(s) que vai usar
- [ ] **Profile/projeto padrão** configurado (ou exportado via env var)
- [ ] **Testou** com comando simples (`aws sts get-caller-identity`, `gcloud config list`, `az account show`)
- [ ] **Claude Code** aberto no terminal onde as CLIs estão autenticadas (mesma sessão shell)

> **Lembrete:** o login de SSO/OAuth expira (AWS SSO ~8-12h, gcloud ~1h com refresh token, Azure ~varia). Se o Claude Code começar a dar erro de autenticação, basta rodar o login novamente no mesmo terminal.

---

## 6. Segurança: o que ter em mente

| Regra | Por quê |
|-------|---------|
| **Nunca dê permissão automática pra comandos de escrita** | `aws ecs update-service`, `gcloud run deploy`, `terraform apply` devem sempre pedir confirmação |
| **Use roles/profiles com least privilege** | Se possível, use uma role read-only pra investigação e uma separada pra deploy |
| **Cuidado com dados sensíveis nos logs** | O Claude Code pode ver outputs de comandos — evite rodar comandos que printem secrets |
| **Revise antes de aprovar** | Leia o comando que o Claude quer rodar antes de aprovar, especialmente se envolver `delete`, `update`, `put`, `create` |
| **Ambientes separados** | Use profiles/configurações diferentes pra prod vs staging — troque explicitamente |

---

## Resumo

| Etapa | O que fazer |
|-------|-------------|
| **1. Instalar CLIs** | AWS CLI v2, gcloud, az — as que você usa |
| **2. Autenticar** | `aws sso login`, `gcloud auth login`, `az login` |
| **3. Configurar profile** | `export AWS_PROFILE=x`, `gcloud config set project x`, `az account set` |
| **4. Abrir Claude Code** | No mesmo terminal autenticado |
| **5. Conversar** | Descreva o que quer investigar/fazer — o specialist certo é invocado automaticamente |
| **6. Aprovar comandos** | Revise e aprove os comandos CLI que o Claude quer rodar |
