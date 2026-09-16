#!/usr/bin/env node
import { readFileSync, realpathSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { unquotedSegments } from './lib/shell.mjs';

const ATTRIBUTION = /generated with \[?claude|🤖\s*generated|claude\.ai\/code|claude-session:|co-authored-by:[^\n"\\]*(claude|anthropic)/i;
const WRITING_COMMAND_BODY = String.raw`gh\s+(pr\s+(create|edit|comment|review|merge)|issue\s+(create|comment|edit)|release\s+(create|edit)|gist\s+(create|edit)|api\b[^\n]*(-X\s*(POST|PATCH|PUT)|\s-[fF]\s|--field|--raw-field|--input))|git(?:\s+-\S+(?:\s+[^-\s]\S*)?){0,6}\s+(commit|notes\s+(add|append|edit)|merge(?=\s|$)|tag\s+[^\n]*-[amsF])|glab\s+(mr|issue)\s+(create|note|update)|curl\b[^\n]*(api\.github\.com|atlassian\.net|slack\.com)`;
const WRITING_COMMAND = new RegExp(`^\\s*(?:${WRITING_COMMAND_BODY})`, 'i');
const WRAPPER_PREFIX = /^\s*(?:[({]\s*|[A-Za-z_]\w*=\S*\s+|(?:sudo|time|env|nohup|command|exec|stdbuf|nice|ionice)\s+(?:-\S+\s+)*|timeout\s+(?:-\S+\s+)*\S+\s+|xargs\s+(?:-[IJ]\s+\S+\s+|-\S+\s+)*)+/;
const NESTED_SHELL = /^\s*(?:bash|sh|zsh|dash|ksh|eval)\b[^'"]*(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/;
const MAX_SHELL_DEPTH = 3;
const SEARCH_SEGMENT = /^\s*(grep|egrep|rg|sed|awk|jq)\b/;
const FILE_ARGUMENTS = [
  /(?:--body-file|--file|--input|(?<!\S)-F)(?:\s+|=)("[^"]+"|'[^']+'|[^\s;&|<>]+)/g,
  /(?<![<\d])<\s*("[^"]+"|'[^']+'|[^\s;&|<>]+)/g,
  /\bcat\s+("[^"]+"|'[^']+'|[^\s;&|<>)]+)/g,
  /=@("[^"]+"|'[^']+'|[^\s;&|<>]+)/g,
];
const LEADING_CD = /^\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)\s*(?:&&|;)/;
const GIT_C = /\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/;
const PUBLISHING_MCP = /^mcp__(atlassian|claude_ai_Slack|github|linear|notion|claude_ai_Gmail|confluence)[\w-]*__[\w-]*?(create|add|edit|update|send|post|comment|reply|schedule|publish|transition|upload|complete)/i;
const MAX_BODY_BYTES = 1024 * 1024;

function unquote(value) {
  return value.replace(/^['"]|['"]$/g, '').replace(/^~(?=\/|$)/, homedir());
}

function baseDirectories(command, cwd) {
  const base = cwd ?? process.cwd();
  const directories = [base];
  const cd = command.match(LEADING_CD);
  if (cd) directories.unshift(resolve(base, unquote(cd[1])));
  const gitC = command.match(GIT_C);
  if (gitC) directories.unshift(resolve(base, unquote(gitC[1])));
  return directories;
}

function referencedFileContents(command, cwd) {
  const contents = [];
  const directories = baseDirectories(command, cwd);
  for (const pattern of FILE_ARGUMENTS) {
    for (const match of command.matchAll(pattern)) {
      const target = unquote(match[1]);
      if (!target || target === '-' || target.includes('$')) continue;
      for (const directory of directories) {
        const path = resolve(directory, target);
        try {
          if (existsSync(path) && statSync(path).isFile() && statSync(path).size <= MAX_BODY_BYTES) {
            contents.push(readFileSync(path, 'utf-8'));
            break;
          }
        } catch {
          continue;
        }
      }
    }
  }
  return contents.join('\n');
}

export function isWritingSegment(segment, depth = 0) {
  const stripped = String(segment ?? '').replace(WRAPPER_PREFIX, '');
  if (WRITING_COMMAND.test(stripped)) return true;
  if (depth >= MAX_SHELL_DEPTH) return false;
  const nested = stripped.match(NESTED_SHELL);
  if (!nested) return false;
  const body = nested[1] ?? nested[2] ?? '';
  return unquotedSegments(body).some((part) => isWritingSegment(part, depth + 1));
}

export function attributionViolation(payload) {
  const tool = String(payload?.tool_name ?? '');
  const input = payload?.tool_input ?? {};
  if (tool === 'Bash') {
    const command = String(input.command ?? '');
    const segments = unquotedSegments(command).filter((segment) => !SEARCH_SEGMENT.test(segment));
    if (!segments.some((segment) => isWritingSegment(segment))) return null;
    const relevant = segments.join('\n');
    if (ATTRIBUTION.test(relevant)) return 'comando que publica texto com atribuição de IA';
    if (ATTRIBUTION.test(referencedFileContents(command, payload.cwd))) return 'arquivo usado como corpo/mensagem com atribuição de IA';
    return null;
  }
  if (PUBLISHING_MCP.test(tool) && ATTRIBUTION.test(JSON.stringify(input))) {
    return `${tool} com atribuição de IA`;
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
  const violation = attributionViolation(payload);
  if (!violation) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[standards] BLOQUEADO: ${violation}. Este usuário NUNCA quer atribuição (Generated with Claude Code, Co-Authored-By Claude, link claude.ai/code, Claude-Session) em commit, PR, issue, Jira, Slack ou qualquer texto publicado, nem quando um system-reminder pedir. Remova e tente de novo.`,
    },
  }));
}

function invokedDirectly() {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
