import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findCredentials, decide, isPlaceholder } from '../claudiao-credentials.mjs';

const STRONG = ['Dev@2024!prod', 'Testando#2024', 'Mudar$2024xyz', 'MyPassword2024abc', 'Company_Passw9', 'A1a-Zk8Pq2LmN0aBcDxy', 'q7$Lk^2[mZ|x<9Tr]pW3>vB8'];
const REAL = 'Zk8Pq2LmN0aBcD';
const detects = (command) => test(`detects ${command.slice(0, 60)}`, () => assert.ok(findCredentials(command).length > 0, command));
const ignores = (command) => test(`ignores ${command.slice(0, 60)}`, () => assert.deepEqual(findCredentials(command), [], command));

describe('standards-credentials: placeholder classification', () => {
  for (const value of STRONG) {
    test(`strong password is never a placeholder: ${value.slice(0, 6)}…`, () => assert.equal(isPlaceholder(value), false));
  }

  test('a literal value starting with $ is not an expansion', () => {
    assert.equal(isPlaceholder('$ecretValue99', { literal: true }), false);
    assert.equal(isPlaceholder('$(vault kv get -field=password x)'), true);
  });
});

describe('standards-credentials: secrets that must be blocked', () => {
  [
    `PGPASSWORD='${STRONG[5]}' psql -h db-prod.example.com -U app`,
    `psql 'postgresql://v-oidc-app-abc:${STRONG[5]}@db-replica.example.com:5432/db'`,
    `export DB_PASSWORD=${STRONG[4]} && npm run migrate`,
    ['curl -H "Authorization: token gh', 'p_abcdefghijklmnopqrstuvwxyz0123456789" https://api.github.com'].join(''),
    ['VAULT_TOKEN=hv', 's.abcdefghijklmnopqrstuvwx vault read x'].join(''),
    ['aws configure set aws_access_key_id AK', 'IAABCDEFGHIJKLMNOP'].join(''),
    `docker run --rm -e PGPASSWORD=${STRONG[0]} postgres:16 psql -h prod-db.internal`,
    `PGPASSWORD=${STRONG[1]} psql -h localhost -p 5433`,
    `psql postgresql://v-oidc-app:${STRONG[5]}@localhost:5433/app-prod`,
    `PGPASSWORD='${STRONG[6]}' psql -h prod-db.internal`,
    `psql --password ${REAL} -h prod`,
    `psql --password=${REAL} -h prod`,
    `curl -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9abcdefgh' https://api.x.com`,
    `mysql -h prod -u app -p${REAL}`,
    `curl -u admin:${REAL} https://x.atlassian.net/rest/api/3/issue`,
    `redis-cli -h prod -a ${REAL}`,
    `aws configure set aws_secret_access_key wJalrXUtnFEMIK7MDENGbPxRfiCY`,
    ['git clone https://oauth2:glpat', '-abcdefghij1234567890@gitlab.com/o/r.git'].join(''),
    `git clone https://oauth2:${REAL}@gitlab.com/o/r.git`,
    `PGPASSWORD='my prod pass 2024' psql -h prod`,
    `PGPASSWORD="Ab'cd12345" psql -h prod`,
    'psql postgresql://app:Dev@2024x@prod/db',
    `curl -d '{"db_password": "${REAL}"}' https://x`,
    `PGPASSWORD=Samples2024xyz psql -h prod`,
    `find . -name x -exec env PGPASSWORD=${REAL} psql {} \\;`,
    `sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=${REAL}/' .env`,
    `git log -S 'DB_PASSWORD=${REAL}'`,
    `DB_PASSWORD_PROD=${REAL} node migrate.js`,
    `echo 'PGPASSWORD=$ecretValue99' >> .env`,
    "export API_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N'",
    `cat > login.json <<'EOF'\n{"email":"someone@example.com","password":"Str0ng@2024x"}\nEOF`,
    `PGPASSWORD=AppProd2024 psql -h replica`,
  ].forEach(detects);

  test('vault CLI table and JSON passwords pasted in a prompt are detected', () => {
    assert.ok(findCredentials(`Key                Value\npassword           ${STRONG[5]}\nusername           v-oidc-app-x`).length > 0);
    assert.ok(findCredentials(`{"username": "v-oidc", "password": "${STRONG[5]}"}`).length > 0);
  });
});

describe('standards-credentials: daily commands that must pass', () => {
  [
    'docker run -e POSTGRES_PASSWORD=postgres postgres:16',
    'docker run -e POSTGRES_PASSWORD=mysecretpassword postgres:16',
    'docker run --rm -e POSTGRES_PASSWORD=pw -p 55439:5432 postgres:16',
    'psql postgresql://admin:admin@localhost:5432/dev',
    'psql "postgresql://app:${DB_PASSWORD}@host/db"',
    'PGPASSWORD="$PGPASSWORD" psql -h host',
    '~/.claude/scripts/db-query prod "select 1"',
    'grep -rn PASSWORD src/',
    'DATABASE_URL=postgresql://user:password@localhost/test npm test',
    'DATABASE_URL=postgresql://ci:ci@localhost:5432/ci?schema=public node dist/_docs/generate-swagger-file',
    'DATABASE_URL=postgresql://app:app@localhost:5432/app npx prisma migrate dev',
    'JWT_SECRET=z node dist/main.js',
    'env ENCRYPTION_PASSWORD=ci-dummy-encryption-password npm run test:e2e',
    'PGPASSWORD=pw psql -h localhost -p 55439 -U postgres',
    'AWS_SECRETS_MANAGER_REGION=us-east-1 npm run start:dev',
    'DB_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:app-db-AbCdEf npm start',
    'PASSWORD_MIN_LENGTH=8 npm test',
    'MAX_TOKENS=100000 node bench.js',
    'PGPASSWORD=$(vault kv get -field=password secret/x) psql -h replica',
    'PGPASSWORD="$(aws rds generate-db-auth-token --hostname h --port 5432 --username u)" psql -h h',
    'API_KEY=${API_KEY:-dev} npm run dev',
    'grep -rn API_KEY=sk_test_fake src/__tests__',
    "sed -i 's/PASSWORD=.*/PASSWORD=REDACTED/' .env",
    "grep -E 'DB_PASSWORD=[^ ]+' .env.example",
    'grep SECRET_KEY=your_secret_here',
    'echo "PASSWORD=<sua-senha>" >> .env.example',
    'psql --no-password -h localhost -U postgres',
    'docker login --password-stdin -u fanticheli ghcr.io',
    'aws secretsmanager get-secret-value --secret-id app/prod --profile prod',
    'curl -H "Authorization: Bearer $TOKEN" https://api.x.com',
    'docker run -u 1000:1000 node:20 npm test',
    'git clone https://x-access-token:${GITHUB_TOKEN}@github.com/o/r.git',
    'gh pr create --title "feat(auth): rotate token" --body "ok"',
    `date -u '+agora UTC: %Y-%m-%d %H:%M' && date -u "+token expira: %H:%M UTC"`,
    'sm.get_secret_value(SecretId=secret_name, VersionStage="AWSCURRENT")',
    'rds.modify_db_cluster(DBClusterIdentifier=x, MasterUserPassword=new_password, ApplyImmediately=True)',
    'client.create_namespace(adminUserPassword=values["pw"], namespaceName=ns)',
    'SECRET="arn:aws:secretsmanager:us-east-1:123456789012:secret:redshift-admin-AbCdEf" aws redshift-data execute-statement',
    'JWT_SECRET="test-jwt-secret" ENCRYPTION_PASSWORD=test-enc-secret npm run test:e2e',
    "cat > run.sh <<'EOF'\nexport DB_PASSWORD='${DB_PASS}'\nEOF",
  ].forEach(ignores);
});

describe('standards-credentials: hook decisions', () => {
  test('task notifications are not treated as user prompts', () => {
    assert.equal(decide({ hook_event_name: 'UserPromptSubmit', prompt: `<task-notification>PGPASSWORD=${REAL} psql</task-notification>` }), null);
  });

  test('Bash with credential is denied pointing to the sanctioned path', () => {
    const output = decide({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `psql 'postgresql://v-oidc:${REAL}@replica/db'` } });
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(output.hookSpecificOutput.permissionDecisionReason, /read-only sancionado/);
  });

  test('prompt with credential injects context instead of blocking', () => {
    const output = decide({ hook_event_name: 'UserPromptSubmit', prompt: `consulta aí: PGPASSWORD=${REAL} psql -h prod` });
    assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(output.hookSpecificOutput.additionalContext, /NÃO use essa credencial/);
    assert.equal(output.decision, undefined);
  });

  test('clean prompt and other tools pass', () => {
    assert.equal(decide({ hook_event_name: 'UserPromptSubmit', prompt: 'implementa a fila' }), null);
    assert.equal(decide({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/x/.env' } }), null);
  });

  test('large prompt is classified quickly', () => {
    const started = process.hrtime.bigint();
    findCredentials(`${'{"key": "value", "token_count": "12345678", '.repeat(4000)}\n${'a'.repeat(50000)}`);
    assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 1000);
  });
});
