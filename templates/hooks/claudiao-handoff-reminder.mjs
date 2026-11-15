#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync, openSync, readSync, closeSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_TRANSCRIPT_BYTES = 300_000;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const EDIT_TOOL_PATTERN = /"name":"(Edit|Write|MultiEdit|NotebookEdit)"/;
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

export function repositoryRoot(cwd) {
  let current = resolve(cwd);
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(cwd);
    current = parent;
  }
}

export function editedFiles(transcriptPath) {
  const files = new Set();
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.includes('"tool_use"') || !EDIT_TOOL_PATTERN.test(line)) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const blocks = Array.isArray(entry.message?.content) ? entry.message.content : [];
    for (const block of blocks) {
      if (block?.type !== 'tool_use' || !EDIT_TOOLS.has(block.name)) continue;
      const target = block.input?.file_path ?? block.input?.notebook_path;
      if (typeof target === 'string') files.add(resolve(target));
    }
  }
  return files;
}

export function gitCommonDir(root) {
  const gitPath = join(root, '.git');
  if (!existsSync(gitPath)) return null;
  if (statSync(gitPath).isDirectory()) return gitPath;
  const match = readFileSync(gitPath, 'utf8').match(/^gitdir:\s*(.+)$/m);
  if (!match) return null;
  const gitDir = resolve(root, match[1].trim());
  const commonDirFile = join(gitDir, 'commondir');
  if (!existsSync(commonDirFile)) return gitDir;
  return resolve(gitDir, readFileSync(commonDirFile, 'utf8').trim());
}

export function sessionEditedRepository(transcriptPath, cwd) {
  const root = repositoryRoot(cwd);
  const targetCommonDir = gitCommonDir(root);
  for (const file of editedFiles(transcriptPath)) {
    if (file === root || file.startsWith(root + sep)) return true;
    if (targetCommonDir && gitCommonDir(repositoryRoot(dirname(file))) === targetCommonDir) return true;
  }
  return false;
}

export function decide(payload, { homeDir = homedir(), tempDir = tmpdir() } = {}) {
  const { session_id: sessionId, cwd, transcript_path: transcriptPath, stop_hook_active: alreadyContinued } = payload ?? {};
  if (alreadyContinued || !sessionId || !cwd || !transcriptPath || !existsSync(transcriptPath)) return null;
  const marker = join(tempDir, `claude-handoff-reminded-${sessionId}`);
  if (existsSync(marker)) return null;
  if (statSync(transcriptPath).size < MIN_TRANSCRIPT_BYTES) return null;
  if (!sessionEditedRepository(transcriptPath, cwd)) return null;

  const memoryDir = join(homeDir, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), 'memory');
  const handoffPath = join(memoryDir, 'session-handoff.md');
  const sessionStart = firstLineTimestamp(transcriptPath);
  if (existsSync(handoffPath) && statSync(handoffPath).mtimeMs > sessionStart) return null;

  writeFileSync(marker, String(Date.now()));
  const action = existsSync(handoffPath) ? 'Reescreva' : 'Crie';
  return {
    decision: 'block',
    reason: `${action} ${handoffPath} antes de encerrar: o que esta sessão fez, o que foi decidido e descartado, pendências com dono e o próximo passo. Substitua o conteúdo, sem acumular histórico. Se a sessão não teve entrega nem decisão, responda só "handoff sem mudança" e encerre.`,
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
