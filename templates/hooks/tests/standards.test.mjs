import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLASHES = '/'.repeat(2);
const workDir = mkdtempSync(join(tmpdir(), 'standards-hooks-'));

function runHook(hook, payload) {
  const result = spawnSync('node', [join(HOOKS_DIR, hook)], { input: JSON.stringify(payload), encoding: 'utf-8' });
  assert.equal(result.status, 0, result.stderr);
  if (!result.stdout.trim()) return { denied: false, reason: '' };
  const output = JSON.parse(result.stdout);
  return {
    denied: output.hookSpecificOutput?.permissionDecision === 'deny',
    reason: output.hookSpecificOutput?.permissionDecisionReason ?? '',
  };
}

function write(hook, fileName, content) {
  return runHook(hook, { tool_name: 'Write', tool_input: { file_path: join(workDir, fileName), content } });
}

function edit(hook, fileName, oldString, newString) {
  return runHook(hook, {
    tool_name: 'Edit',
    tool_input: { file_path: join(workDir, fileName), old_string: oldString, new_string: newString },
  });
}

function commit(command) {
  return runHook('claudiao-commit-message.mjs', { tool_name: 'Bash', tool_input: { command } });
}

describe('standards-no-comments', () => {
  const hook = 'claudiao-no-comments.mjs';

  const denied = [
    ['line comment', 'a.ts', `const a = 1;\n${SLASHES} explain a\nconst b = 2;`],
    ['inline comment', 'a.ts', `const a = 1; ${SLASHES} explain`],
    ['jsdoc', 'a.ts', '/**\n * Finds the candidate\n */\nexport function find() {}'],
    ['jsx comment', 'a.tsx', 'return (<div>{/* header */}<Header /></div>);'],
    ['python comment', 'a.py', 'x = 1\n# explain x'],
    ['python inline', 'a.py', 'x = 1  # explain'],
    ['sql comment', 'a.sql', 'select id\n-- only active\nfrom users'],
    ['dbt jinja comment', 'a.sql', '{# header #}\nselect 1'],
    ['vue html comment', 'a.vue', '<template>\n<!-- list -->\n<ul></ul>\n</template>'],
    ['go comment', 'a.go', `func main() {\n\t${SLASHES} start\n}`],
  ];
  for (const [name, file, content] of denied) {
    test(`denies ${name}`, () => assert.equal(write(hook, file, content).denied, true));
  }

  const allowed = [
    ['url in string', 'a.ts', "const url = 'https://digai.ai/jobs';"],
    ['double slash in string', 'a.ts', `const s = "a ${SLASHES} b";`],
    ['eslint directive', 'a.ts', `${SLASHES} eslint-disable-next-line no-console\nconsole.log(1);`],
    ['ts-expect-error', 'a.ts', `${SLASHES} @ts-expect-error legacy typing\nfoo();`],
    ['shebang', 'a.py', '#!/usr/bin/env python3\nprint(1)'],
    ['hash in python string', 'a.py', 'x = "issue # 3"'],
    ['type ignore', 'a.py', 'import foo  # type: ignore'],
    ['plain sql', 'a.sql', 'select id, name from users where active'],
    ['markdown file', 'a.md', '# Title\n<!-- note -->'],
    ['multiplication continuation', 'a.ts', 'const total = price\n  * quantity;'],
    ['clean code', 'a.ts', 'export function findCandidate(id: string) {\n  return repository.find(id);\n}'],
  ];
  for (const [name, file, content] of allowed) {
    test(`allows ${name}`, () => {
      const result = write(hook, file, content);
      assert.equal(result.denied, false, result.reason);
    });
  }

  test('allows moving an existing comment inside an edit', () => {
    const legacy = `${SLASHES} legacy\nconst a = 1;`;
    assert.equal(edit(hook, 'a.ts', legacy, `const b = 0;\n${legacy}`).denied, false);
  });
});

describe('standards-english-code', () => {
  const hook = 'claudiao-english-code.mjs';

  const denied = [
    ['portuguese file name', 'buscar-candidato.service.ts', 'export class CandidateService {}'],
    ['portuguese const', 'a1.ts', 'const buscarCandidato = async () => null;'],
    ['portuguese function', 'a2.ts', 'function calcularPontuacao() { return 1; }'],
    ['portuguese class', 'a3.ts', 'export class Vaga {}'],
    ['portuguese interface', 'a4.ts', 'export interface UsuarioDto { id: string }'],
    ['portuguese method', 'a5.ts', 'class A {\n  async buscarVagas(id: string): Promise<void> {\n  }\n}'],
    ['portuguese private field', 'a6.ts', 'class A {\n  private readonly listaDeCandidatos: string[] = [];\n}'],
    ['accented identifier', 'a7.ts', 'const validação = true;'],
    ['plural portuguese', 'a8.ts', 'const configuracoes = {};'],
    ['python def', 'a9.py', 'def calcular_nota(x):\n    return x'],
    ['python assignment', 'a10.py', 'nome_completo = "x"'],
    ['go func', 'a11.go', 'func BuscarUsuario() {}'],
    ['go short declaration', 'a12.go', 'func run() {\n\tquantidade := 1\n}'],
    ['sql create table', 'a13.sql', 'create table hiring__vaga (id uuid)'],
    ['sql alias', 'a14.sql', 'select name as nome_candidato,\n id from users'],
  ];
  for (const [name, file, content] of denied) {
    test(`denies ${name}`, () => assert.equal(write(hook, file, content).denied, true));
  }

  const englishIdentifiers = [
    'statusList', 'dataSource', 'pageSize', 'modelName', 'planId', 'limitValue', 'noteText', 'mediaUrl',
    'anomalyScore', 'processQueue', 'projectId', 'contractAddress', 'agendaItem', 'routeHandler',
    'sessionToken', 'customerId', 'totalAmount', 'errorMessage', 'fileName', 'userId', 'bankAccount',
    'cargoWeight', 'metaTags', 'diagramNode', 'estimateCost', 'cpfNumber', 'itemsTotal', 'notes', 'modes',
    'pages', 'plans', 'cacao', 'formatDate', 'isActive', 'hiredCandidate', 'screeningRepository',
  ];
  test('allows common english identifiers', () => {
    const content = englishIdentifiers.map((name) => `const ${name} = 1;`).join('\n');
    const result = write(hook, 'english.ts', content);
    assert.equal(result.denied, false, result.reason);
  });

  const allowed = [
    ['usage of existing portuguese table', 'b1.ts', 'const screenings = await prisma.triagem.findMany();'],
    ['portuguese ui copy in string', 'b2.ts', "const label = 'Buscar candidato';"],
    ['python kwarg to external api', 'b3.py', 'client.send(\n    nome=name,\n)'],
    ['english go', 'b4.go', 'func FindUser() {\n\tuserName := "x"\n}'],
    ['english sql alias', 'b5.sql', 'select nome as candidate_name,\n id from users'],
    ['tsx component', 'b6.tsx', 'export function JobOpeningCard({ title }: Props) {\n  const [isOpen, setIsOpen] = useState(false);\n  return <div>{title}</div>;\n}'],
    ['non code file', 'buscar.md', 'const buscarCandidato = 1'],
  ];
  for (const [name, file, content] of allowed) {
    test(`allows ${name}`, () => {
      const result = write(hook, file, content);
      assert.equal(result.denied, false, result.reason);
    });
  }

  test('allows portuguese identifiers when editing an existing file', () => {
    writeFileSync(join(workDir, 'service.ts'), 'export function findCandidate(id: string) {\n  return id;\n}\n');
    const result = edit(hook, 'service.ts', 'return id;', 'const candidatoAtual = id;\n  return candidatoAtual;');
    assert.equal(result.denied, false, result.reason);
  });

  test('allows overwriting an existing portuguese file', () => {
    writeFileSync(join(workDir, 'triagem-score.adapter.ts'), 'export class TriagemScoreAdapter {}\n');
    const result = write(hook, 'triagem-score.adapter.ts', 'export class TriagemScoreAdapter {\n  calcularNota() {\n  }\n}\n');
    assert.equal(result.denied, false, result.reason);
  });

  test('denies a new file in a portuguese domain module', () => {
    assert.equal(write(hook, 'triagem-ranking.adapter.ts', 'export class ScreeningRankingAdapter {}').denied, true);
  });
});

describe('standards-commit-message', () => {
  const denied = [
    ['portuguese verb', 'git commit -m "fix(hp): corrige ranking"'],
    ['portuguese prose', 'git commit -m "fix(hp): escopa o accepted_values de dimension para depois do conserto na origem"'],
    ['accents', 'git commit -m "fix(api): handle validação"'],
    ['not semantic', 'git commit -m "update stuff"'],
    ['bracket squash style', 'git commit -m "[Fix] Handle null candidate"'],
    ['attribution heredoc', "git commit -m \"$(cat <<'EOF'\nfeat(queue): make the queue idempotent\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nEOF\n)\""],
    ['session link', "git commit -m \"$(cat <<'EOF'\nfix(api): handle timeout\n\nClaude-Session: https://claude.ai/code/session_x\nEOF\n)\""],
    ['portuguese body', "git commit -m \"$(cat <<'EOF'\nfix(queue): make the queue idempotent\n\nagora a fila não duplica quando o job roda de novo\nEOF\n)\""],
    ['combined flags', "git add . && git commit -am 'ajusta os testes'"],
  ];
  for (const [name, command] of denied) {
    test(`denies ${name}`, () => assert.equal(commit(command).denied, true));
  }

  const allowed = [
    ['semantic english', 'git commit -m "fix(hired-candidate): make the hired candidate queue idempotent"'],
    ['ticket suffix', 'git commit -m "feat(movement-rules): reuse the setup screen for screening creation (CET-599)"'],
    ['git -C and -am', "git -C /tmp/repo commit -am 'chore(ci): bump node to 22'"],
    ['breaking change', 'git commit -m "feat(api)!: drop the v1 endpoints"'],
    ['english heredoc with body', "git commit -m \"$(cat <<'EOF'\nrefactor(hp): extract the scoring rules\n\nThe scorer now lives in its own use case so the worker stays thin.\nEOF\n)\""],
    ['single stray portuguese word', 'git commit -m "feat(pricing): add pro plan"'],
    ['amend no edit', 'git commit --amend --no-edit'],
    ['merge message', "git commit -m \"Merge branch 'main' into feature/x\""],
    ['not a commit', 'git status && git log --oneline -5'],
    ['portuguese company scope', 'git commit -m "feat(recrutamento): add the final HP score"'],
  ];
  for (const [name, command] of allowed) {
    test(`allows ${name}`, () => {
      const result = commit(command);
      assert.equal(result.denied, false, result.reason);
    });
  }
});
