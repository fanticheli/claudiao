---
name: sql-templates
description: Templates SQL prontos para diagnóstico de performance, migrations zero-downtime, e operações comuns em PostgreSQL
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
model: sonnet
---

# SQL Templates

Templates SQL prontos para uso em diagnóstico e operações de banco PostgreSQL.

## Quando ativar

Ative quando o usuário estiver:
- Investigando query lenta ou problema de performance
- Criando migration que altera tabelas em produção
- Precisando de templates para operações comuns de banco

## Templates

### Diagnóstico de Query Lenta

```sql
-- 1. Analise o plano de execução
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;

-- 2. Verifique estatísticas da tabela
SELECT schemaname, relname, seq_scan, idx_scan, n_live_tup, n_dead_tup
FROM pg_stat_user_tables WHERE relname = 'sua_tabela';

-- 3. Liste indexes existentes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sua_tabela';

-- 4. Queries mais lentas (requer pg_stat_statements)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;

-- 5. Locks ativos
SELECT pid, usename, query, state, wait_event_type, wait_event
FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;
```

### Migration Zero-Downtime (Expand-Contract)

```sql
-- EXPAND: Adicione coluna sem NOT NULL (não trava tabela)
ALTER TABLE users ADD COLUMN email_normalized VARCHAR(255);

-- MIGRATE: Backfill em batches (evita lock longo)
UPDATE users SET email_normalized = LOWER(TRIM(email))
WHERE id BETWEEN $start AND $end;

-- VALIDATE: Verifique consistência
SELECT COUNT(*) FROM users WHERE email_normalized IS NULL;

-- CONTRACT: Aplique constraints (após backfill completo)
ALTER TABLE users ALTER COLUMN email_normalized SET NOT NULL;
```

### Criação Segura de Index

```sql
-- SEMPRE use CONCURRENTLY em produção (não bloqueia writes)
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Verifique se o index foi criado com sucesso (CONCURRENTLY pode falhar silenciosamente)
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'users' AND indexname = 'idx_users_email';

-- Se falhou, drope o index inválido e tente novamente
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;
```

### Health Check Rápido

```sql
-- Tabelas maiores (espaço em disco)
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- Bloat de tabelas (dead tuples acumulados)
SELECT relname, n_dead_tup, n_live_tup,
  ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 2) AS dead_pct
FROM pg_stat_user_tables WHERE n_dead_tup > 1000 ORDER BY n_dead_tup DESC;

-- Conexões ativas
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;

-- Cache hit ratio (deve ser > 99%)
SELECT ROUND(
  SUM(heap_blks_hit) / GREATEST(SUM(heap_blks_hit) + SUM(heap_blks_read), 1) * 100, 2
) AS cache_hit_ratio FROM pg_statio_user_tables;
```
