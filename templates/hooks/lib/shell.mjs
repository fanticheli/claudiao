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
