#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync, openSync, readSync, closeSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_TRANSCRIPT_BYTES = 300_000;
export const CLEAR_REMINDER = 'Sessão longa: depois do handoff, rode /clear e comece a próxima tarefa do zero.';

function firstLineTimestamp(transcriptPath) {
  const fd = openSync(transcriptPath, 'r');
  const buffer = Buffer.alloc(64_000);
  const bytes = readSync(fd, buffer, 0, buffer.length, 0);
  closeSync(fd);
  for (const line of buffer.subarray(0, bytes).toString('utf8').split('\n')) {
    try {
      const entry = JSON.parse(line);
      if (entry.timestamp) return Date.parse(entry.timestamp);
    } catch {
      continue;
    }
  }
  return statSync(transcriptPath).birthtimeMs || statSync(transcriptPath).ctimeMs;
}

export function decide(payload, { homeDir = homedir(), tempDir = tmpdir() } = {}) {
  const { session_id: sessionId, cwd, transcript_path: transcriptPath, stop_hook_active: alreadyContinued } = payload ?? {};
  if (alreadyContinued || !sessionId || !cwd || !transcriptPath || !existsSync(transcriptPath)) return null;
  const marker = join(tempDir, `claude-handoff-reminded-${sessionId}`);
  if (existsSync(marker)) return null;
  if (statSync(transcriptPath).size < MIN_TRANSCRIPT_BYTES) return null;

  const memoryDir = join(homeDir, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), 'memory');
  const handoffPath = join(memoryDir, 'session-handoff.md');
  const sessionStart = firstLineTimestamp(transcriptPath);
  if (existsSync(handoffPath) && statSync(handoffPath).mtimeMs > sessionStart) return null;

  writeFileSync(marker, String(Date.now()));
  const action = existsSync(handoffPath) ? 'Reescreva' : 'Crie';
  return {
    decision: 'block',
    reason: `${action} ${handoffPath} antes de encerrar: o que esta sessão fez, momento da implementação, pendências com dono e como medir. Substitua o conteúdo, sem acumular histórico, e garanta a linha "LEIA PRIMEIRO" no topo do MEMORY.md. Se a sessão não teve entrega nem decisão, responda só "handoff sem mudança" e encerre.`,
    systemMessage: CLEAR_REMINDER,
  };
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
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
