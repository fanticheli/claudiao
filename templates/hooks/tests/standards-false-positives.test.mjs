import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attributionViolation } from '../claudiao-no-attribution.mjs';

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLASHES = '/'.repeat(2);
const TRAILER = ['https:', SLASHES, 'claude', '.ai/code/session_01XZ'].join('');
const workDir = mkdtempSync(join(tmpdir(), 'standards-fp-'));

function write(hook, fileName, content) {
  const payload = { tool_name: 'Write', tool_input: { file_path: join(workDir, fileName), content } };
  const result = spawnSync('node', [join(HOOKS_DIR, hook)], { input: JSON.stringify(payload), encoding: 'utf-8' });
  assert.equal(result.status, 0, result.stderr);
  if (!result.stdout.trim()) return { denied: false, reason: '' };
  const output = JSON.parse(result.stdout);
  return {
    denied: output.hookSpecificOutput?.permissionDecision === 'deny',
    reason: output.hookSpecificOutput?.permissionDecisionReason ?? '',
  };
}

describe('no-comments: text inside multiline strings is not code comment', () => {
  const documentation = [
    'from pathlib import Path',
    '',
    'ENTRY = """',
    '## [Unreleased]',
    '',
    '### Adicionado',
    '',
    '- hook novo',
    '"""',
    '',
    'Path("CHANGELOG.md").write_text(ENTRY)',
  ].join('\n');

  test('python docstring with markdown headings passes', () => {
    assert.equal(write('claudiao-no-comments.mjs', 'docs.py', documentation).denied, false);
  });

  test('javascript template literal with slashes passes', () => {
    const content = ['export const snippet = `', `${SLASHES} isto e exemplo de saida`, '`;'].join('\n');
    assert.equal(write('claudiao-no-comments.mjs', 'snippet.js', content).denied, false);
  });

  test('a real python comment is still blocked', () => {
    const content = ['DOC = """', 'texto', '"""', '', '# calcula o score', 'score = 1'].join('\n');
    const result = write('claudiao-no-comments.mjs', 'scorer.py', content);
    assert.equal(result.denied, true);
    assert.match(result.reason, /calcula o score/);
  });

  test('a real javascript comment after a template literal is still blocked', () => {
    const content = ['const t = `x`;', `${SLASHES} soma os itens`, 'const total = 1;'].join('\n');
    assert.equal(write('claudiao-no-comments.mjs', 'total.js', content).denied, true);
  });
});

describe('no-attribution: the publishing command must be in command position', () => {
  const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

  test('documentation mentioning both a commit and the trailer passes', () => {
    const script = [
      'python3 - <<PY',
      'from pathlib import Path',
      `text = "| commit | Bash com git commit | bloqueia ${TRAILER} |"`,
      'Path("README.md").write_text(text)',
      'PY',
    ].join('\n');
    assert.equal(attributionViolation(bash(script)), null);
  });

  test('heredoc that writes a script running a real commit with the trailer is blocked', () => {
    const script = [
      'cat > release.sh <<EOF',
      `git commit -m "chore(release): v2${'\\n'}${TRAILER}"`,
      'EOF',
    ].join('\n');
    assert.notEqual(attributionViolation(bash(script)), null);
  });

  test('normal publishing commands stay blocked', () => {
    assert.notEqual(attributionViolation(bash(`gh pr create --title x --body "feito${'\\n'}${TRAILER}"`)), null);
    assert.notEqual(attributionViolation(bash(`git commit -m "fix(a): b${'\\n'}${TRAILER}"`)), null);
    assert.notEqual(attributionViolation(bash(`cd repo && git commit -m "fix(a): b ${TRAILER}"`)), null);
  });

  test('attribution regex does not blow up on many git flags', () => {
    const flags = '-a '.repeat(40);
    const started = process.hrtime.bigint();
    attributionViolation(bash(`git ${flags}status`));
    assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 200);
  });
});

writeFileSync(join(workDir, '.keep'), '');
