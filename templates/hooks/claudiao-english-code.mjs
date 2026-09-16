#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { isPortugueseIdentifier, portugueseWordsInIdentifier, hasNonAscii } from './lib/portuguese.mjs';

const JS_FAMILY = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte']);
const LANGUAGE_BY_EXT = {
  py: 'python',
  go: 'go',
  sql: 'sql',
  rb: 'generic', java: 'generic', kt: 'generic', kts: 'generic', cs: 'generic', php: 'generic',
  rs: 'generic', swift: 'generic', scala: 'generic', dart: 'generic',
};

const CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'await', 'typeof', 'new', 'else',
  'constructor', 'super', 'import', 'export', 'do', 'try', 'with', 'yield', 'delete', 'void',
]);

const PATTERNS = {
  js: [
    /\b(?:const|let|var)\s+([A-Za-z_$À-ɏ][\w$À-ɏ]*)/g,
    /\bfunction\s*\*?\s*([A-Za-z_$À-ɏ][\w$À-ɏ]*)/g,
    /\b(?:class|interface|type|enum|namespace)\s+([A-Za-z_$À-ɏ][\w$À-ɏ]*)/g,
    /^\s*(?:(?:public|private|protected|static|readonly|async|override|abstract|get|set)\s+)*([A-Za-z_$À-ɏ][\w$À-ɏ]*)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^{=;]+)?\{\s*$/g,
    /^\s*(?:(?:public|private|protected|static|readonly|declare|override)\s+)+([A-Za-z_$À-ɏ][\w$À-ɏ]*)\s*[?!]?\s*[:=]/g,
  ],
  python: [
    /^\s*(?:async\s+)?def\s+([A-Za-z_À-ɏ][\wÀ-ɏ]*)/g,
    /^\s*class\s+([A-Za-z_À-ɏ][\wÀ-ɏ]*)/g,
    /^\s*([A-Za-z_À-ɏ][\wÀ-ɏ]*)\s*(?::\s*[^=]+)?\s+=\s+/g,
  ],
  go: [
    /\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_À-ɏ][\wÀ-ɏ]*)/g,
    /\b(?:var|const|type)\s+([A-Za-z_À-ɏ][\wÀ-ɏ]*)/g,
    /^\s*([A-Za-z_À-ɏ][\wÀ-ɏ]*(?:\s*,\s*[A-Za-z_À-ɏ][\wÀ-ɏ]*)*)\s*:=/g,
  ],
  generic: [
    /\b(?:class|interface|enum|struct|trait|record|object|module|fun|fn|def|val|var|let|const|type)\s+([A-Za-z_$À-ɏ][\w$À-ɏ]*)/g,
  ],
  sql: [
    /\bcreate\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view|function|procedure|index|type|schema)\s+(?:if\s+not\s+exists\s+)?([\w."À-ɏ]+)/gi,
    /\badd\s+column\s+(?:if\s+not\s+exists\s+)?("?[\wÀ-ɏ]+"?)/gi,
    /\brename\s+(?:column\s+)?[\w"]+\s+to\s+("?[\wÀ-ɏ]+"?)/gi,
    /\bas\s+("?[A-Za-z_À-ɏ][\wÀ-ɏ]*"?)\s*(?:,|$|\bfrom\b)/gim,
  ],
};

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return null;
  }
}

function extensionOf(filePath) {
  return (filePath.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
}

function languageFor(ext) {
  if (JS_FAMILY.has(ext)) return 'js';
  return LANGUAGE_BY_EXT[ext] ?? null;
}

function stripNonCode(text, language) {
  return text
    .split('\n')
    .map((line) => {
      const withoutStrings = line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, language === 'sql' ? (m) => (m.startsWith('"') ? m : "''") : '""');
      if (language === 'python') return withoutStrings.replace(/#.*$/, '');
      if (language === 'sql') return withoutStrings.replace(/--.*$/, '');
      return withoutStrings.replace(/\/\/.*$/, '');
    })
    .join('\n');
}

function declaredNames(text, language) {
  const code = stripNonCode(String(text ?? ''), language);
  const names = new Set();
  for (const line of code.split('\n')) {
    for (const pattern of PATTERNS[language]) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        for (const raw of match[1].split(',')) {
          const name = raw.trim().replace(/"/g, '').split('.').pop();
          if (name && !CONTROL_KEYWORDS.has(name)) names.add(name);
        }
      }
    }
  }
  return names;
}

const payload = readPayload();
const toolName = payload?.tool_name ?? '';
const input = payload?.tool_input;
const filePath = input?.file_path;
if (typeof filePath !== 'string' || !filePath) process.exit(0);

const ext = extensionOf(filePath);
const language = languageFor(ext);
if (!language) process.exit(0);

if (toolName !== 'Write' || existsSync(filePath)) process.exit(0);

const problems = [];

const stem = basename(filePath).replace(/\.[^/]*$/, '');
if (isPortugueseIdentifier(stem)) {
  const detail = hasNonAscii(stem) ? 'caractere não-ASCII' : portugueseWordsInIdentifier(stem).join(', ');
  problems.push(`nome de arquivo "${basename(filePath)}" (${detail})`);
}

for (const name of declaredNames(input.content, language)) {
  if (!isPortugueseIdentifier(name)) continue;
  const detail = hasNonAscii(name) ? 'caractere não-ASCII' : portugueseWordsInIdentifier(name).join(', ');
  problems.push(`identificador "${name}" (${detail})`);
}

if (problems.length === 0) process.exit(0);

const reason = [
  `[standards] BLOQUEADO: arquivo NOVO com nomes em português (${filePath}).`,
  'Regra global (~/.claude/rules/code-standards.md): todo arquivo NOVO nasce 100% em inglês (nome do arquivo, variáveis, funções, classes, types, colunas), em qualquer projeto. Alterações em arquivos existentes não são bloqueadas.',
  `Detectado:\n${problems.slice(0, 8).map((problem) => `  - ${problem}`).join('\n')}`,
  'Renomeie para inglês (ex.: buscarCandidato -> findCandidate, vaga -> jobOpening, triagem -> screening). Nomes que já existem no banco/API externa podem ser referenciados como estão (ex.: prisma.triagem); só o que você declara precisa estar em inglês. Texto de UI/copy dentro de strings pode continuar em pt-BR.',
].join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
