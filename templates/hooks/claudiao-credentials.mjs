#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIN_REAL_SECRET_LENGTH = 6;
const PLACEHOLDER_VALUE = /^(<[^>]*>|\{\{[^}]*\}\}|\w*_here|changeme|change_me|redacted|\[redacted\]|sample|example|x{3,}|\*{3,})$/i;
const PLACEHOLDER_FRAGMENT = /dummy|fake|placeholder|example|redacted|your[_-]?(password|secret|token|key)/i;
const DEV_VALUE = /^(postgres|password|secret|testing|localdev|devpass\d*|mysecretpassword|supersecret\w*|secret123|password123|123456)$/i;
const CODE_REFERENCE = /^[a-z_]\w*(?:[.\[(].*)?[,)]*$/;
const CODE_REFERENCE_MARKER = /[_.\[(]/;
const LOWERCASE_WORDS = /^[a-z]+(?:-[a-z]+)+$/;
const TEMPLATE_EXPANSION = /^\$\{[A-Za-z_]\w*(?::?[-=?+][^}]*)?\}$/;
const REGEX_LIKE_VALUE = /\.\*|\.\+|\\[sSwWdD]|\[\^|\[[a-z0-9]-[a-z0-9]\]|\{\d/i;
const NON_SECRET_NAME = /(?:^|[_-]|[a-z])(REGION|ARN|NAME|ID|IDS|LENGTH|TTL|PATH|FILE|DIR|URL|URI|ENDPOINT|HOST|PORT|ENABLED|VERSION|PREFIX|DAYS|SECONDS|TIMEOUT|EXPIRES[_-]IN|EXPIRATION|ROTATION|COUNT|TYPE|MODE|KEY[_-]ID|MANAGER)$/i;
const SECRET_KEY_NAME = /(^|[_-])(password|passwd|secret|api[_-]?key|apikey|token|access[_-]?key|private[_-]?key)([_-]|$)/i;
const SEARCH_SEGMENT = /^\s*(grep|egrep|fgrep|rg|ag|sed|awk|jq|git\s+(log|grep))\b/;
const SED_SEGMENT = /^\s*sed\b/;
const SED_SUBSTITUTION = /\bs([\/|#,:@!])(?:\\.|(?!\1)[^\n])*\1((?:\\.|(?!\1)[^\n])*)\1[gIip0-9]*/g;
const INJECTED_PROMPT = /^\s*<(task-notification|system-reminder|local-command|bash-input|bash-stdout|bash-stderr|command-name|command-message)/;
const VALUE = `(?:'([^']*)'|"((?:[^"\\\\]|\\\\.)*)"|([^\\s'"\`;|&()]+))`;

const TOKEN_PATTERNS = [
  { name: 'chave AWS', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'token GitHub', pattern: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
  { name: 'token GitLab', pattern: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { name: 'token Vault', pattern: /\bhvs\.[A-Za-z0-9]{20,}\b/ },
  { name: 'token Slack', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'chave Anthropic', pattern: /\bsk-ant-[A-Za-z0-9-]{20,}\b/ },
];

const VALUE_PATTERNS = [
  {
    name: 'senha em variável',
    pattern: new RegExp(`\\b(\\w*(?:PASSWORD|PASSWD|SECRET|API_KEY|AUTH_TOKEN|ACCESS_TOKEN|_TOKEN)\\w*)=${VALUE}`, 'gi'),
    extract: (match) => (NON_SECRET_NAME.test(match[1]) ? [] : [quotedValue(match, 2)]),
  },
  {
    name: 'senha em flag',
    pattern: new RegExp(`(?:^|\\s)--([\\w-]*(?:password|passwd|secret|token|api-key|apikey))(?:=|\\s+)${VALUE}`, 'gi'),
    extract: (match) => {
      const candidate = quotedValue(match, 2);
      return NON_SECRET_NAME.test(match[1]) || candidate.value.startsWith('-') ? [] : [candidate];
    },
  },
  {
    name: 'senha em -p do mysql',
    pattern: new RegExp(`\\b(?:mysql|mysqldump|mysqladmin|mariadb)\\b[^\\n]*?\\s-p${VALUE}`, 'g'),
    extract: (match) => [quotedValue(match, 1)],
  },
  {
    name: 'senha do redis-cli',
    pattern: new RegExp(`\\bredis-cli\\b[^\\n]*?\\s(?:-a|--pass)\\s+${VALUE}`, 'g'),
    extract: (match) => [quotedValue(match, 1)],
  },
  {
    name: 'usuário:senha em -u',
    pattern: new RegExp(`\\b(?:curl|wget|http)\\b[^\\n]*?\\s(?:-u|--user)(?:\\s+|=)${VALUE}`, 'g'),
    extract: (match) => {
      const candidate = quotedValue(match, 1);
      const separator = candidate.value.indexOf(':');
      if (separator < 1) return [];
      return [{ ...candidate, user: candidate.value.slice(0, separator), value: candidate.value.slice(separator + 1) }];
    },
  },
  {
    name: 'token em header',
    pattern: /\b(?:authorization:\s*(?:bearer|token|basic)|x-api-key:|private-token:|api-key:)\s*([A-Za-z0-9._~+\/=:-]{8,})/gi,
    extract: (match) => [{ value: match[1], literal: true }],
  },
  {
    name: 'segredo no aws configure',
    pattern: new RegExp(`\\baws\\s+configure\\s+set\\s+(?:aws_secret_access_key|aws_session_token)\\s+${VALUE}`, 'gi'),
    extract: (match) => [quotedValue(match, 1)],
  },
  {
    name: 'senha em JSON',
    pattern: /"([\w-]{1,60})"\s*:\s*"((?:[^"\\]|\\.){8,})"/g,
    extract: (match) => (SECRET_KEY_NAME.test(match[1]) && !NON_SECRET_NAME.test(match[1]) ? [{ value: match[2], literal: true }] : []),
  },
  {
    name: 'senha no formato da CLI',
    pattern: /^\s*(?:password|secret_key)\s{2,}(\S{8,})\s*$/gim,
    extract: (match) => [{ value: match[1], literal: true }],
  },
  {
    name: 'usuário:senha em URL',
    pattern: /\b(?:postgres(?:ql)?|redshift|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|https?|ssh|git|s?ftp):\/\/([^:\/\s@'"`]+):([^\s'"`\/]*)@[^@\s'"`\/]+/gi,
    extract: (match) => [{ user: match[1], value: match[2] }],
  },
];

function quotedValue(match, firstGroup) {
  const single = match[firstGroup];
  const double = match[firstGroup + 1];
  const bare = match[firstGroup + 2];
  if (single !== undefined) return { value: single, literal: true };
  if (double !== undefined) return { value: double, literal: false };
  return { value: bare ?? '' };
}

function insideSingleQuotes(text, position) {
  let quote = null;
  for (let index = 0; index < position; index += 1) {
    const char = text[index];
    if (quote === '"' && char === '\\') {
      index += 1;
    } else if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    }
  }
  return quote === "'";
}

export function isPlaceholder(value, { literal = false, searching = false, user } = {}) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length < MIN_REAL_SECRET_LENGTH) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (!literal && /^[$`]/.test(trimmed)) return true;
  if (TEMPLATE_EXPANSION.test(trimmed) || /^arn:aws/.test(trimmed)) return true;
  if (!literal && CODE_REFERENCE.test(trimmed) && CODE_REFERENCE_MARKER.test(trimmed)) return true;
  if (LOWERCASE_WORDS.test(trimmed)) return true;
  if (user !== undefined && user === trimmed) return true;
  if (searching && REGEX_LIKE_VALUE.test(trimmed)) return true;
  return PLACEHOLDER_VALUE.test(trimmed) || PLACEHOLDER_FRAGMENT.test(trimmed) || DEV_VALUE.test(trimmed);
}

export function unquotedSegments(text) {
  const source = String(text ?? '');
  const result = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      current += char;
      if (char === '\\' && quote === '"') {
        current += source[index + 1] ?? '';
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    const two = source.slice(index, index + 2);
    if (two === '&&' || two === '||') {
      result.push(current);
      current = '';
      index += 1;
      continue;
    }
    if (char === '|' || char === ';' || char === '\n') {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

function normalizeSegment(segment) {
  if (!SED_SEGMENT.test(segment)) return segment;
  return segment.replace(SED_SUBSTITUTION, (_, delimiter, replacement) => ` ${replacement} `);
}

export function credentialMatches(text) {
  const matches = [];
  const source = String(text ?? '');
  for (const { name, pattern } of TOKEN_PATTERNS) {
    const match = source.match(pattern);
    if (match) matches.push({ name, value: match[0] });
  }
  for (const rawSegment of unquotedSegments(source)) {
    const searching = SEARCH_SEGMENT.test(rawSegment);
    const segment = normalizeSegment(rawSegment);
    for (const { name, pattern, extract } of VALUE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of segment.matchAll(pattern)) {
        for (const candidate of extract(match)) {
          const literal = candidate.literal ?? insideSingleQuotes(segment, match.index);
          if (!isPlaceholder(candidate.value, { literal, searching, user: candidate.user })) {
            matches.push({ name, value: candidate.value, context: match[0].slice(0, 40) });
          }
        }
      }
    }
  }
  return matches;
}

export function findCredentials(text) {
  return [...new Set(credentialMatches(text).map(({ name }) => name))];
}

export function decide(payload) {
  const event = payload?.hook_event_name;
  if (event === 'UserPromptSubmit') {
    const prompt = String(payload.prompt ?? '');
    if (INJECTED_PROMPT.test(prompt)) return null;
    const kinds = findCredentials(prompt);
    if (kinds.length === 0) return null;
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `[standards] A mensagem do Igor contém credencial (${kinds.join(', ')}). NÃO use essa credencial em comandos, arquivos ou respostas, e não a repita. Para banco de prod use ~/.claude/scripts/db-query. Se for lease do Vault, recomende revogar ao final. Se não houver caminho sem a credencial, peça pra ele rodar o comando com ! no prompt.`,
      },
    };
  }
  if (event === 'PreToolUse' && payload.tool_name === 'Bash') {
    const kinds = findCredentials(payload.tool_input?.command);
    if (kinds.length === 0) return null;
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `[standards] BLOQUEADO: credencial inline no comando (${kinds.join(', ')}). Aprovar isso grava o segredo em settings.local.json e no transcript. Use ~/.claude/scripts/db-query para banco de prod, $(vault ...)/variável de ambiente já carregada ou ~/.pgpass. Não bloqueia: valor curto (<6), usuário igual à senha, dummy/fake/example e senhas padrão de container (postgres, mysecretpassword...). Para outros casos, peça pro Igor rodar com ! no prompt.`,
      },
    };
  }
  return null;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return;
  }
  const output = decide(payload);
  if (output) process.stdout.write(JSON.stringify(output));
}

function invokedDirectly() {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
