---
name: sql-templates
description: Templates SQL prontos para diagnóstico de performance, migrations zero-downtime, e operações comuns em PostgreSQL
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
model: sonnet
---

# SQL Templates

Templates SQL para PostgreSQL, prontos para uso em operações sensíveis e
diagnóstico de performance. Todo exemplo assume PostgreSQL 12+.

## Quando ativar

- Investigando query lenta ou regressão de performance
- Criando migration que altera tabelas em produção (especialmente >1M rows)
- Renomeando coluna, adicionando `NOT NULL`, ou mudando tipo sem downtime
- Precisando de health check ou diagnóstico rápido do banco

## Princípios

1. **Nunca trave escrita em tabelas grandes.** Qualquer `ALTER` que faz
   rewrite é incidente em produção.
2. **Sempre `CONCURRENTLY` em index.** E valide que não ficou `INVALID`.
3. **Backfill em batches com `SKIP LOCKED`.** Transação única em 10M rows
   explode WAL e trava replicação.
4. **Expand-Migrate-Contract.** Adiciona novo, migra dados, remove antigo
   — nunca tudo numa migration só.

---

## Diagnóstico de Query Lenta

```sql
-- 1. Plano de execução (inclua BUFFERS sempre)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT ...;

-- 2. Queries mais custosas (requer pg_stat_statements)
SELECT
  substring(query, 1, 120)     AS query_preview,
  calls,
  round(mean_exec_time::numeric, 2)   AS mean_ms,
  round(total_exec_time::numeric, 2)  AS total_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- 3. Estatísticas da tabela (scan ratio e bloat signal)
SELECT
  relname,
  seq_scan, idx_scan,
  n_live_tup, n_dead_tup,
  last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'sua_tabela';

-- 4. Indexes existentes + tamanho
SELECT
  i.indexname,
  pg_size_pretty(pg_relation_size(i.indexname::regclass)) AS size,
  i.indexdef
FROM pg_indexes i
WHERE i.tablename = 'sua_tabela'
ORDER BY pg_relation_size(i.indexname::regclass) DESC;

-- 5. Locks ativos (quem está travando quem)
SELECT
  pid, usename, state,
  wait_event_type, wait_event,
  now() - query_start AS duration,
  substring(query, 1, 120) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- 6. Estatísticas desatualizadas (ANALYZE pode ser a solução)
SELECT
  relname,
  n_mod_since_analyze,
  last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE n_mod_since_analyze > 10000
ORDER BY n_mod_since_analyze DESC;
```

---

## Criação Segura de Index

```sql
-- SEMPRE CONCURRENTLY em produção (não bloqueia writes)
-- NUNCA dentro de transação explícita
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Validar que o index ficou VALID (CONCURRENTLY pode falhar silenciosamente)
SELECT indexrelid::regclass, indisvalid, indisready
FROM pg_index
WHERE indrelid = 'users'::regclass
  AND indisvalid = false;
-- Se houver linhas: index está inválido, DROP + recria

-- Se inválido, remove e tenta de novo
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;

-- Após criar, atualize estatísticas
ANALYZE users;

-- Index parcial (reduz tamanho drasticamente)
CREATE INDEX CONCURRENTLY idx_orders_pending
  ON orders (created_at)
  WHERE status = 'pending';

-- Index composto seguindo regra (equality, range, order by)
CREATE INDEX CONCURRENTLY idx_events_user_time
  ON events (user_id, created_at DESC);

-- BRIN para séries temporais append-only (100x menor que BTREE)
CREATE INDEX CONCURRENTLY idx_events_time_brin
  ON events USING BRIN (created_at)
  WITH (pages_per_range = 32);
```

---

## Migration Zero-Downtime: Adicionar Coluna com Backfill

Cenário: adicionar `timezone` NOT NULL em `users` (10M rows), default `'UTC'`.

```sql
-- ============================================================
-- STEP 1 — EXPAND: adiciona coluna NULL (metadata only, instant)
-- ============================================================
ALTER TABLE users ADD COLUMN timezone TEXT;

-- Default aplicado APENAS a novos registros (não reescreve tabela)
ALTER TABLE users ALTER COLUMN timezone SET DEFAULT 'UTC';

-- ============================================================
-- STEP 2 — BACKFILL em batches (rode como job externo)
-- ============================================================
-- Nunca UPDATE em tabela inteira numa transação: explode WAL e
-- trava replicação. Use loop com batch pequeno + pg_sleep.

-- Opção A: loop PL/pgSQL (requer pg_background ou script externo — COMMIT dentro de DO só em pg13+)
DO $$
DECLARE
  batch_size INT := 10000;
  affected INT;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM users
      WHERE timezone IS NULL
      ORDER BY id
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    )
    UPDATE users u
    SET timezone = 'UTC'
    FROM batch b
    WHERE u.id = b.id;

    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;

    COMMIT;            -- só funciona em procedure (pg11+) ou script externo
    PERFORM pg_sleep(0.1);   -- alivia autovacuum e replicação
  END LOOP;
END $$;

-- Opção B: bash loop (mais confiável em prod)
-- psql -c "UPDATE users SET timezone = 'UTC'
--          WHERE id IN (SELECT id FROM users WHERE timezone IS NULL LIMIT 10000 FOR UPDATE SKIP LOCKED)"
-- repetir até affected = 0

-- ============================================================
-- STEP 3 — VALIDATE: garantir 100% preenchido
-- ============================================================
SELECT
  COUNT(*) FILTER (WHERE timezone IS NULL) AS pending,
  COUNT(*) AS total
FROM users;
-- pending DEVE ser 0 antes de seguir

-- ============================================================
-- STEP 4 — CONTRACT: aplicar NOT NULL sem full scan
-- ============================================================
-- SET NOT NULL direto faz full table scan (trava leitura).
-- Use CHECK NOT VALID + VALIDATE pra evitar scan exclusivo.

ALTER TABLE users
  ADD CONSTRAINT users_timezone_not_null
  CHECK (timezone IS NOT NULL) NOT VALID;

-- VALIDATE scaneia sem lock exclusivo (só ShareUpdateExclusive)
ALTER TABLE users VALIDATE CONSTRAINT users_timezone_not_null;

-- Opcional: promover pra NOT NULL "nativo" (pg12+ detecta CHECK e evita re-scan)
ALTER TABLE users ALTER COLUMN timezone SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_timezone_not_null;

-- ============================================================
-- ROLLBACK de emergência (antes do STEP 4)
-- ============================================================
-- ALTER TABLE users DROP COLUMN timezone;
```

---

## Migration Zero-Downtime: Renomear Coluna

`ALTER TABLE ... RENAME COLUMN` é instant no DB, mas **quebra a aplicação**
se nem todos os instances estão na versão nova. Faça dual-write.

```sql
-- STEP 1 — adiciona coluna nova
ALTER TABLE orders ADD COLUMN placed_at TIMESTAMPTZ;

-- STEP 2 — cria trigger de sync bidirecional (app ainda escreve no velho)
CREATE OR REPLACE FUNCTION sync_orders_placed_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.placed_at := NEW.created_at;
  ELSIF NEW.placed_at IS DISTINCT FROM OLD.placed_at THEN
    NEW.created_at := NEW.placed_at;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_orders_placed_at
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_orders_placed_at();

-- STEP 3 — backfill (em batches, como acima)
UPDATE orders SET placed_at = created_at WHERE placed_at IS NULL;

-- STEP 4 — deploy app lendo `placed_at`, ainda escrevendo em ambos
-- STEP 5 — deploy app só usando `placed_at` (ignora `created_at`)

-- STEP 6 — cleanup depois de algumas semanas
DROP TRIGGER trg_sync_orders_placed_at ON orders;
DROP FUNCTION sync_orders_placed_at;
ALTER TABLE orders DROP COLUMN created_at;
```

---

## Migration Zero-Downtime: Mudar Tipo de Coluna

`ALTER COLUMN TYPE` faz rewrite da tabela. Em tabela grande, use expand-contract.

```sql
-- Caso: VARCHAR(50) → TEXT em tabela grande (tecnicamente gratuito, mas rewrite trava)
-- Melhor: adicionar coluna nova, migrar, dropar velha.

ALTER TABLE products ADD COLUMN description_new TEXT;

-- Trigger copia mudanças da velha pra nova
CREATE OR REPLACE FUNCTION sync_products_description() RETURNS TRIGGER AS $$
BEGIN
  NEW.description_new := NEW.description;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_products_description
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION sync_products_description();

-- Backfill (batches)
UPDATE products SET description_new = description WHERE description_new IS NULL;

-- Após app migrar para coluna nova:
ALTER TABLE products DROP COLUMN description;
ALTER TABLE products RENAME COLUMN description_new TO description;
```

---

## Adicionar Foreign Key sem Lock Longo

```sql
-- FK validada imediata scanea toda tabela com lock exclusivo. Evite.
-- Use NOT VALID + VALIDATE em 2 passos.

-- Passo 1: adiciona FK sem validar (rápido, lock curto)
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;

-- Passo 2: valida em background (ShareUpdateExclusive, não bloqueia writes)
ALTER TABLE orders VALIDATE CONSTRAINT orders_customer_id_fkey;
```

---

## Reindex sem Travar

```sql
-- REINDEX tradicional trava tabela. Use CONCURRENTLY (pg12+).
REINDEX INDEX CONCURRENTLY idx_orders_status;

-- Banco inteiro (longo, mas não trava)
REINDEX DATABASE CONCURRENTLY mydb;

-- Alternativa pré-pg12: criar index novo com nome diferente, dropar antigo
CREATE INDEX CONCURRENTLY idx_orders_status_new ON orders (status);
DROP INDEX CONCURRENTLY idx_orders_status;
ALTER INDEX idx_orders_status_new RENAME TO idx_orders_status;
```

---

## Partitioning de Tabela Grande

```sql
-- Cenário: tabela events (50M rows) ficando lenta
-- Estratégia: particionar por RANGE em created_at

-- Nova tabela particionada
CREATE TABLE events_new (
  id BIGSERIAL,
  user_id BIGINT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Partições mensais
CREATE TABLE events_2026_04 PARTITION OF events_new
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE events_2026_05 PARTITION OF events_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Default pra pegar datas fora das partições declaradas
CREATE TABLE events_default PARTITION OF events_new DEFAULT;

-- Migração: INSERT com ON CONFLICT DO NOTHING, em batches
INSERT INTO events_new SELECT * FROM events
  WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01'
  ON CONFLICT DO NOTHING;

-- Swap final (curto downtime ou via view/trigger durante transição)
BEGIN;
ALTER TABLE events RENAME TO events_old;
ALTER TABLE events_new RENAME TO events;
COMMIT;

-- Para automação de partições: use pg_partman
```

---

## Detecção de Bloat e Cleanup

```sql
-- Tabelas com mais bloat
SELECT
  relname,
  n_live_tup, n_dead_tup,
  ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 2) AS dead_pct,
  pg_size_pretty(pg_total_relation_size(relid))               AS total_size,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Tunar autovacuum pra tabelas quentes específicas
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);

-- VACUUM manual (mais agressivo que autovacuum)
VACUUM (VERBOSE, ANALYZE) orders;

-- pg_repack: reorganiza tabela sem lock exclusivo (requer extensão)
-- $ pg_repack -d mydb -t orders
```

---

## Health Check Rápido

```sql
-- Tabelas maiores (disco)
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid))       AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- Conexões por estado
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;

-- Cache hit ratio (deve ser > 99% em OLTP saudável)
SELECT ROUND(
  SUM(heap_blks_hit) / GREATEST(SUM(heap_blks_hit) + SUM(heap_blks_read), 1) * 100, 2
) AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Long-running queries (candidatos a kill)
SELECT
  pid,
  now() - query_start AS duration,
  state,
  wait_event,
  substring(query, 1, 200) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '30 seconds'
ORDER BY duration DESC;

-- Matar query travada (CUIDADO)
-- SELECT pg_cancel_backend(PID);   -- gentil
-- SELECT pg_terminate_backend(PID); -- forçado
```

---

## Anti-patterns a Evitar

| Anti-pattern | Problema | Solução |
|---|---|---|
| `ALTER TABLE ... SET NOT NULL` direto | Full scan com lock exclusivo | `CHECK NOT VALID` + `VALIDATE` |
| `CREATE INDEX` sem `CONCURRENTLY` | Bloqueia writes até terminar | Sempre `CONCURRENTLY` em prod |
| `UPDATE` em tabela inteira numa transação | Explode WAL, trava replicação | Batches com `SKIP LOCKED` |
| `ALTER COLUMN TYPE` em tabela grande | Rewrite completo, lock exclusivo | Expand-contract com coluna nova |
| `SELECT COUNT(*)` em tabela grande como check | Seq scan 10M+ rows | `pg_class.reltuples` (aproximado) |
| Migration de schema + data juntos | Rollback complexo | Separar: schema change → deploy → data migration |
| `DELETE` em massa sem batch | WAL bloat + lock longo | `DELETE ... WHERE id IN (SELECT id ... LIMIT N)` em loop |
