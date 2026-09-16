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

const WRAPPER_PREFIX = /^\s*(?:[({]\s*|(?:then|do|else|elif)\s+|[A-Za-z_]\w*=(?:\$\([^()]*\)|"[^"]*"|'[^']*'|\S*)\s+|(?:sudo|time|env|nohup|command|exec|stdbuf|nice|ionice)\s+(?:-\S+\s+)*|timeout\s+(?:-\S+\s+)*\S+\s+|xargs\s+(?:-[IJ]\s+\S+\s+|-\S+\s+)*)+/;
const COMMAND_SUBSTITUTION = /\$\(([^()]*)\)/g;
const NESTED_SHELL = /^\s*(?:bash|sh|zsh|dash|ksh|eval)\b[^'"]*(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/;
const MAX_SHELL_DEPTH = 3;

export function commandSegments(text, depth = 0) {
  const segments = [];
  for (const segment of unquotedSegments(text)) {
    for (const match of segment.matchAll(COMMAND_SUBSTITUTION)) segments.push(match[1]);
    const stripped = segment.replace(WRAPPER_PREFIX, '');
    segments.push(stripped);
    if (depth >= MAX_SHELL_DEPTH) continue;
    const nested = stripped.match(NESTED_SHELL);
    if (nested) segments.push(...commandSegments(nested[1] ?? nested[2] ?? '', depth + 1));
  }
  return segments;
}
