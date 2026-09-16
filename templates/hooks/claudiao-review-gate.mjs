#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, mkdtempSync, existsSync, statSync, realpathSync, renameSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandSegments } from './lib/shell.mjs';

export const REVIEWER = 'independent-reviewer';
const PR_COMMAND = /^\s*(?:\S*\/)?(?:gh\s+(?:pr\s+create\b|api\b[^\n]*\/pulls\b)|glab\s+mr\s+create\b|hub\s+pull-request\b|git\s+push\b[^\n]*merge_request\.create)/;
const PENDING_EXPIRY_MS = 30 * 60 * 1000;
const UNAVAILABLE_RETRY_MS = 10 * 60 * 1000;
const MAX_UNTRACKED_BYTES = 2 * 1024 * 1024;
const GIT_TIMEOUT_MS = 3000;
const LOCK_WAIT_MS = 2500;
const LOCK_STALE_MS = 15000;
const MIN_CHANGED_LINES = () => Number(process.env.REVIEW_GATE_MIN_LINES) || 60;
const SKIP_DIRECTIVE = /(^|[\s(\[,.;:])(sem review|no-review|skip review)\s*[)\].!]*\s*$/i;
const LEADING_CD = /^\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)\s*(?:&&|;)/;
const ABSOLUTE_PATH_TOKEN = /(?:^|[\s='"(:])((?:~\/|\/)[^\s'";|&()<>`$]+)/g;
const GIT_C_PATH = /\bgit\s+(?:-\S+\s+)*?-C\s+("[^"]+"|'[^']+'|\S+)/g;
const TOOLING_REPOS = /\/(\.nvm|\.cache|\.local\/share|\.cargo|\.rustup|\.pyenv|\.asdf|\.oh-my-zsh|snap|node_modules|\.vscode-server|\.cursor-server)\//;
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const AGENT_TOOLS = new Set(['Agent', 'Task']);
const IGNORED_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|uv\.lock|Cargo\.lock|go\.sum|swagger-[\w-]+\.json|[^/]+\.snap)$|(^|\/)(dist|build|coverage|node_modules|\.next|__snapshots__)\//;
const BEHAVIOR_DOCS = /(^|\/)(CLAUDE|SKILL|AGENTS)\.md$|(^|\/)(\.claude|templates)\/(agents|rules|commands|skills)\//;
const DOC_FILES = /\.(md|mdx|txt|rst|adoc|csv|tsv|png|jpe?g|gif|svg|webp|ico|pdf|log)$/i;
const DOCS_HTML = /(^|\/)docs?\/.*\.html?$/i;

const COMMAND_START = String.raw`(?:^|[;&|({\n]\s*|\b(?:xargs|sudo|env|nice|nohup|command|exec|time|then|do|else)\s+(?:-\S+\s+)*|\btimeout\s+(?:-\S+\s+)*\S+\s+)\\?(?:\/usr)?(?:\/s?bin\/)?`;
const GIT_PREFIX = String.raw`\bgit\s+(?:(?:-c\s+\S+|-C\s+\S+|--no-pager|--git-dir=\S+|--work-tree=\S+)\s+)*`;
const SAFE_TARGET = String.raw`(?!\/dev\/|\/tmp\/|&\d|\$\{?TMPDIR)`;
const READ_ONLY_VIOLATIONS = [
  [new RegExp(String.raw`(^|[^<>&\d])(\d|&)?>>?\|?\s*${SAFE_TARGET}[^\s;|&)]+`), 'redirecionamento para arquivo fora de /tmp'],
  [new RegExp(String.raw`\btee\s+(?:-\w+\s+)*${SAFE_TARGET}[^\s;|&)]+`), 'tee para arquivo fora de /tmp'],
  [/\b(sed|perl)\b[^\n;|&]*\s(-[a-zA-Z]*i(\b|\.)|--in-place)/, 'edição in-place'],
  [new RegExp(`${COMMAND_START}(touch|patch|rm|rmdir|mv|cp|ln|chmod|chown|truncate|dd|shred|unlink)(?=\\s|$|[;&|)}])`), 'comando que altera arquivos'],
  [/(>>?\|?|\btee\s+(?:-\w+\s+)*)\s*[^\s;|&)]*\.\.\//, 'caminho com .. em escrita'],
  [new RegExp(String.raw`${COMMAND_START}mkdir\s+(?:-\w+\s+)*(?!-|\/tmp\/|\$\{?TMPDIR)\S`), 'mkdir fora de /tmp'],
  [new RegExp(String.raw`${GIT_PREFIX}(add|commit|checkout|switch|reset|am|restore|push|pull|fetch|clean|rebase|merge|cherry-pick|revert|rm|mv|gc|prune|update-ref|update-index)\b`), 'git com efeito colateral'],
  [new RegExp(String.raw`${GIT_PREFIX}apply\b(?![^\n;|&]*--(check|stat|numstat|summary))`), 'git apply'],
  [/\b(npm|pnpm|yarn|bun)\s+(install|i|ci|add|remove|uninstall|publish|update|upgrade|link|version)\b/, 'instalação de pacotes'],
  [/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(?![\w:-]*check)[\w:-]*(format|fix|write|migrate|seed|deploy|release|publish)[\w:-]*\b/, 'script que escreve'],
  [/\b(pip3?|uv\s+pip|uv\s+add|poetry)\s+(install|add|remove|uninstall)\b/, 'instalação de pacotes'],
  [/\bprettier\b[^\n;|&]*\s(--write|-w)\b/, 'formatter com escrita'],
  [/\beslint\b[^\n;|&]*\s--fix\b/, 'formatter com escrita'],
  [/\bruff\s+format\b(?![^\n;|&]*--(check|diff))|\bruff\s+check\b[^\n;|&]*--fix\b/, 'formatter com escrita'],
  [/\bblack\b(?![^\n;|&]*--(check|diff))\s+\S/, 'formatter com escrita'],
  [/\bgofmt\b[^\n;|&]*\s-w\b|\bbiome\b[^\n;|&]*\s--(write|apply)\b/, 'formatter com escrita'],
  [/\b(jest|vitest)\b[^\n;|&]*\s(-u|--updateSnapshot|--update)\b/, 'atualização de snapshot'],
  [/\bfind\b[^\n;|&]*\s(-delete|-exec\s+\S*(rm|mv|sed|tee))\b/, 'find com escrita'],
  [/\b(bash|sh|zsh|dash)\s+-\w*c\b/, 'shell aninhado'],
  [/\b(python3?|node|deno|bun|ruby|perl)\s+(-\w+\s+)*-(c|e|p)\b/, 'código inline'],
  [/\bcurl\b[^\n;|&]*\s(-o|-O|--output|--remote-name)\b|\bwget\b/, 'download para arquivo'],
  [/\bdbt\s+(run|seed|build|snapshot|run-operation)\b|\bprisma\s+(migrate|db\s+(push|seed|execute))\b/, 'escrita em banco'],
  [/\bgh\s+(pr\s+(merge|close|create|edit|comment|review|ready)|issue\s+(create|close|edit|comment)|release\s+(create|delete)|repo\s+(create|delete|edit)|api\s+[^\n;|&]*-X\s*(POST|PUT|PATCH|DELETE))\b/, 'escrita no GitHub'],
  [/\b(pulumi|psql|mongosh|mysql|redis-cli|kubectl\s+(apply|delete|edit|patch|scale)|docker\s+(run|rm|exec|compose\s+(up|down))|terraform\s+(apply|destroy|import))\b/, 'comando com efeito externo'],
  [/\bvault\s+(write|delete|kv\s+(put|delete|patch))\b/, 'escrita no Vault'],
  [/\baws\s+(?:--\S+\s+\S+\s+)*[\w-]+\s+(put|create|delete|update|modify|start(?!-query)|stop(?!-query)|terminate|remove|attach|detach|reboot|restore|invoke|publish|send)-[\w-]+/, 'escrita na AWS'],
];

const GIT_MULTIPURPOSE = new RegExp(String.raw`${GIT_PREFIX}(stash|worktree|submodule|tag|branch|config|remote|notes)\b([^\n;|&)]*)`, 'g');
const VALUE_FLAGS = new Set(['--contains', '--no-contains', '--points-at', '--merged', '--no-merged', '--sort', '--format', '--type', '--default', '--color']);
const LISTING_FLAGS = {
  tag: /^(-l|--list|-n\d*|-i|--ignore-case|--column|--no-column|--sort=\S+|--format=\S+|--contains|--no-contains|--points-at|--merged|--no-merged|--sort|--format)$/,
  branch: /^(-[avrl]+|-vv|--show-current|--list|--all|--remotes|--verbose|-i|--ignore-case|--column|--no-column|--color(=\S+)?|--no-color|--sort=\S+|--format=\S+|--contains|--no-contains|--points-at|--merged|--no-merged|--sort|--format)$/,
  config: /^(--global|--local|--system|--worktree|--show-origin|--show-scope|--name-only|-z|--null|--includes|--no-includes|--type=\S+|--type|--default=\S*|--default|--get|--get-all|--get-regexp|--get-urlmatch|-l|--list)$/,
};

function gitArguments(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function positionalsOutsideValues(args) {
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    if (VALUE_FLAGS.has(args[index])) {
      index += 1;
      continue;
    }
    if (!args[index].startsWith('-')) positionals.push(args[index]);
  }
  return positionals;
}

function gitSubcommandIsRead(subcommand, args) {
  const [first, ...rest] = args;
  switch (subcommand) {
    case 'stash':
    case 'notes':
      return first === 'list' || first === 'show';
    case 'worktree':
      return first === 'list';
    case 'submodule':
      return args.length === 0 || first === 'status' || first === 'summary';
    case 'remote':
      if (args.length === 0) return true;
      if (first === '-v' || first === '--verbose') return rest.length === 0;
      return first === 'show' || first === 'get-url';
    case 'tag':
    case 'branch': {
      if (!args.every((arg) => !arg.startsWith('-') || LISTING_FLAGS[subcommand].test(arg))) return false;
      const listing = args.some((arg) => /^(-l|--list)$/.test(arg) || (subcommand === 'branch' && /^-[avr]*l[avr]*$/.test(arg)));
      return positionalsOutsideValues(args).length === 0 || listing;
    }
    case 'config': {
      if (first === 'get' || first === 'list') return rest.every((arg) => !arg.startsWith('-') || LISTING_FLAGS.config.test(arg));
      if (!args.every((arg) => !arg.startsWith('-') || LISTING_FLAGS.config.test(arg))) return false;
      const reading = args.some((arg) => /^(--get|--get-all|--get-regexp|--get-urlmatch|-l|--list)$/.test(arg));
      return reading || positionalsOutsideValues(args).length <= 1;
    }
    default:
      return false;
  }
}

function gitMultipurposeViolation(shell) {
  for (const match of shell.matchAll(GIT_MULTIPURPOSE)) {
    if (!gitSubcommandIsRead(match[1], gitArguments(match[2]))) return `git ${match[1]} com efeito colateral`;
  }
  return null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function git(root, args, options = {}) {
  return execFileSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
    input: options.input,
    env: options.indexFile ? { ...process.env, GIT_INDEX_FILE: options.indexFile } : process.env,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function repoRoot(path) {
  if (typeof path !== 'string' || !path) return null;
  let directory = path.replace(/^~(?=\/|$)/, homedir());
  while (directory && directory !== '/' && !existsSync(directory)) directory = dirname(directory);
  if (!directory || directory === '/') return null;
  try {
    if (!statSync(directory).isDirectory()) directory = dirname(directory);
    const root = git(directory, ['rev-parse', '--show-toplevel']).trim() || null;
    return root && !TOOLING_REPOS.test(`${root}/`) ? root : null;
  } catch {
    return null;
  }
}

function smallUntrackedFiles(root) {
  return git(root, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter((path) => {
      try {
        return statSync(join(root, path)).size <= MAX_UNTRACKED_BYTES;
      } catch {
        return false;
      }
    });
}

export function snapshotTree(root) {
  const scratch = mkdtempSync(join(tmpdir(), 'review-gate-index-'));
  const indexFile = join(scratch, 'index');
  try {
    const realIndex = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
    if (existsSync(realIndex)) copyFileSync(realIndex, indexFile);
    git(root, ['add', '-u'], { indexFile });
    const untracked = smallUntrackedFiles(root);
    if (untracked.length > 0) git(root, ['add', '--pathspec-from-file=-', '--pathspec-file-nul'], { indexFile, input: untracked.join('\0') });
    return git(root, ['write-tree'], { indexFile }).trim();
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function isReviewableFile(relativePath) {
  if (IGNORED_FILES.test(relativePath)) return false;
  if (BEHAVIOR_DOCS.test(relativePath)) return true;
  if (DOCS_HTML.test(relativePath)) return false;
  return !DOC_FILES.test(relativePath);
}

export function changedFiles(root, fromTree, toTree) {
  if (!fromTree || !toTree || fromTree === toTree) return [];
  return git(root, ['diff', '--numstat', '--no-renames', '-z', fromTree, toTree])
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const [added, removed, ...rest] = record.split('\t');
      const relativePath = rest.join('\t');
      const lines = added === '-' ? 1 : Number(added) + Number(removed);
      return { relativePath, path: join(root, relativePath), lines };
    })
    .filter((file) => isReviewableFile(file.relativePath));
}

export function emptyState() {
  return { repos: {}, pending: [], skip: false, unavailable: {}, failedThisTurn: {} };
}

function snapshotOrMark(state, root, now) {
  const failedAt = state.unavailable[root];
  if (failedAt && now - failedAt < UNAVAILABLE_RETRY_MS) return null;
  try {
    const tree = snapshotTree(root);
    delete state.unavailable[root];
    return tree;
  } catch {
    state.unavailable[root] = now;
    state.failedThisTurn[root] = true;
    return null;
  }
}

function trackRepo(state, root, now) {
  if (!root || state.repos[root]) return;
  const tree = snapshotOrMark(state, root, now);
  if (tree) state.repos[root] = { baseline: tree, reviewed: null, lateBaseline: Boolean(state.failedThisTurn[root]) };
}

const BASE_REFS = ['origin/HEAD', 'origin/main', 'origin/master', 'origin/develop', 'origin/trunk', 'main', 'master', 'develop', 'trunk'];

function gitOrEmpty(root, args) {
  try {
    return git(root, args).trim();
  } catch {
    return '';
  }
}

export function pullRequestBase(root) {
  for (const ref of BASE_REFS) {
    const resolved = gitOrEmpty(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (!resolved) continue;
    const base = gitOrEmpty(root, ['merge-base', 'HEAD', resolved]);
    if (base) return base;
  }
  return '';
}

const SAFE_QUOTED = /^(\/tmp\/|\$\{?TMPDIR)(?!.*\.\.)/;

export function maskQuotedAndHeredocs(command) {
  const text = String(command);
  const terminators = [];
  let output = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '\n' && terminators.length > 0) {
      output += '\n';
      index += 1;
      while (terminators.length > 0 && index < text.length) {
        const lineEnd = text.indexOf('\n', index);
        const line = lineEnd === -1 ? text.slice(index) : text.slice(index, lineEnd);
        index = lineEnd === -1 ? text.length : lineEnd + 1;
        if (line.replace(/^\t+/, '').trim() === terminators[0]) terminators.shift();
      }
      continue;
    }
    if (char === '\\') {
      if (text[index + 1] !== '\n') output += text.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === '#' && (index === 0 || /[\s;&|(]/.test(text[index - 1]))) {
      const lineEnd = text.indexOf('\n', index);
      index = lineEnd === -1 ? text.length : lineEnd;
      continue;
    }
    if (char === '$' && text[index + 1] === "'") {
      let end = index + 2;
      while (end < text.length && text[end] !== "'") end += text[end] === '\\' ? 2 : 1;
      output += '__Q__';
      index = end + 1;
      continue;
    }
    if (text.startsWith('$((', index)) {
      let depth = 0;
      let end = index + 1;
      for (; end < text.length; end += 1) {
        if (text[end] === '(') depth += 1;
        if (text[end] === ')') depth -= 1;
        if (depth === 0) break;
      }
      output += '0';
      index = end + 1;
      continue;
    }
    if (char === "'" || char === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== char) end += char === '"' && text[end] === '\\' ? 2 : 1;
      const content = text.slice(index + 1, end);
      output += SAFE_QUOTED.test(content) ? content.replace(/\s/g, '_') : '__Q__';
      index = end + 1;
      continue;
    }
    if (text.startsWith('<<<', index)) {
      output += '<<<';
      index += 3;
      continue;
    }
    const opener = text.slice(index).match(/^<<-?\s*(['"]?)([A-Za-z_]\w*)\1/);
    if (opener) {
      terminators.push(opener[2]);
      output += '<<__HEREDOC__';
      index += opener[0].length;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

export function readOnlyViolation(toolName, toolInput) {
  if (WRITE_TOOLS.has(toolName)) return `${toolName} não é permitido`;
  if (toolName !== 'Bash') return null;
  const shell = maskQuotedAndHeredocs(toolInput?.command ?? '');
  const hit = READ_ONLY_VIOLATIONS.find(([pattern]) => pattern.test(shell));
  return hit ? hit[1] : gitMultipurposeViolation(shell);
}

function displayPath(path) {
  return path.startsWith(`${homedir()}/`) ? `~/${relative(homedir(), path)}` : path;
}

function reviewBase(root, repo) {
  return pullRequestBase(root) || repo.baseline;
}

function reviewableChanges(state, now, roots = null) {
  const selected = roots ? roots.filter((root) => state.repos[root]) : Object.keys(state.repos);
  const files = [];
  const trees = {};
  const unverifiable = Object.keys(state.unavailable).filter((root) => !state.repos[root]);
  for (const root of selected) {
    const repo = state.repos[root];
    if (repo.lateBaseline && !unverifiable.includes(root)) unverifiable.push(root);
    const tree = snapshotOrMark(state, root, now);
    if (!tree) {
      unverifiable.push(root);
      continue;
    }
    trees[root] = tree;
    if (repo.reviewed && changedFiles(root, repo.reviewed, tree).length === 0) continue;
    files.push(...changedFiles(root, reviewBase(root, repo), tree));
  }
  return { files, trees, unverifiable };
}

export function bashRepoCandidates(command, cwd) {
  const text = String(command ?? '');
  const candidates = [cwd];
  const cd = text.match(LEADING_CD)?.[1];
  if (cd) candidates.push(cd);
  for (const match of text.matchAll(GIT_C_PATH)) candidates.push(match[1]);
  for (const match of text.matchAll(ABSOLUTE_PATH_TOKEN)) candidates.push(match[1]);
  const directories = [];
  for (const candidate of candidates) {
    const clean = String(candidate ?? '').replace(/^['"]|['"]$/g, '');
    if (!clean || clean.includes('$')) continue;
    const expanded = clean.replace(/^~(?=\/|$)/, homedir());
    if (/^\/(proc|dev|sys)(\/|$)/.test(expanded) || directories.includes(expanded)) continue;
    directories.push(expanded);
    if (directories.length >= 12) break;
  }
  return directories;
}

export function onUserPromptSubmit(payload, state, now) {
  state.skip = SKIP_DIRECTIVE.test(String(payload.prompt ?? '').trim());
  state.pending = state.pending.filter((launch) => now - launch.launchedAt < PENDING_EXPIRY_MS);
  if (state.pending.length > 0) return null;
  state.unavailable = {};
  state.failedThisTurn = {};
  trackRepo(state, repoRoot(payload.cwd), now);
  return null;
}

export function onPreToolUse(payload, state, now) {
  const toolName = payload.tool_name;
  const input = payload.tool_input ?? {};

  if (AGENT_TOOLS.has(toolName) && input.subagent_type === REVIEWER) {
    const { files, trees } = reviewableChanges(state, now);
    const names = [...new Set(files.map((file) => basename(file.path)))];
    if (names.length > 0) {
      const prompt = String(input.prompt ?? '');
      const missing = files.filter((file) => !prompt.includes(basename(file.path)));
      if (missing.length > 0) {
        return { deny: `[review-gate] O prompt do ${REVIEWER} precisa citar os arquivos alterados. Faltam: ${[...new Set(missing.map((file) => displayPath(file.path)))].join(', ')}` };
      }
    }
    state.pending.push({ trees, launchedAt: now });
    return null;
  }

  if (WRITE_TOOLS.has(toolName)) {
    trackRepo(state, repoRoot(input.file_path ?? input.notebook_path), now);
  } else if (toolName === 'Bash') {
    const roots = new Set(bashRepoCandidates(input.command, payload.cwd).map(repoRoot).filter(Boolean));
    for (const root of roots) trackRepo(state, root, now);
    if (isPullRequestCommand(payload)) return pullRequestDecision(payload, state, now);
  }
  return null;
}

export function isPullRequestCommand(payload) {
  if (payload?.tool_name !== 'Bash') return false;
  return commandSegments(String(payload.tool_input?.command ?? '')).some((segment) => PR_COMMAND.test(segment));
}

function pullRequestRoots(payload, state, now) {
  const candidates = new Set();
  const cwdRoot = repoRoot(payload.cwd);
  if (cwdRoot) candidates.add(cwdRoot);
  for (const path of bashRepoCandidates(String(payload.tool_input?.command ?? ''), payload.cwd)) {
    const root = repoRoot(path);
    if (root) candidates.add(root);
  }
  for (const root of candidates) trackRepo(state, root, now);
  const known = [...candidates].filter((root) => state.repos[root]);
  return known.length > 0 ? known : Object.keys(state.repos);
}

function pullRequestDecision(payload, state, now) {
  if (state.skip) return null;
  state.pending = state.pending.filter((launch) => now - launch.launchedAt < PENDING_EXPIRY_MS);
  if (state.pending.length > 0) {
    return { deny: '[review-gate] Revisão independente ainda rodando. Espere o resultado, trate os achados e só então abra o PR.' };
  }
  const { files, unverifiable } = reviewableChanges(state, now, pullRequestRoots(payload, state, now));
  const warning = unverifiable.length > 0 ? `[review-gate] Não consegui verificar ${unverifiable.map(displayPath).join(', ')} (git lento ou indisponível); essas mudanças NÃO foram checadas pelo gate.` : null;
  const changedLines = files.reduce((sum, file) => sum + file.lines, 0);
  if (changedLines < MIN_CHANGED_LINES()) return warning ? { message: warning } : null;
  const listed = [...new Set(files.map((file) => displayPath(file.path)))];
  return { deny: [blockReason(listed, changedLines), warning].filter(Boolean).join('\n') };
}

export function onSubagentStop(payload, state, now) {
  if (payload.agent_type !== REVIEWER || state.pending.length === 0) return null;
  const launch = state.pending.shift();
  const changed = [];
  for (const [root, tree] of Object.entries(launch.trees)) {
    const current = snapshotOrMark(state, root, now);
    if (!current || changedFiles(root, tree, current).length > 0) changed.push(root);
  }
  if (changed.length > 0) {
    const recovery = changed.map((root) => `git -C ${root} diff ${launch.trees[root]}  (restaurar: git -C ${root} restore --source=${launch.trees[root]} --worktree -- <arquivo>)`).join('\n');
    return { message: `[review-gate] Arquivos revisáveis mudaram durante a revisão (${changed.map(displayPath).join(', ')}), pelo revisor ou por edições em paralelo. Essa revisão NÃO conta.\nEstado de antes da revisão, pra conferir ou recuperar:\n${recovery}` };
  }
  for (const [root, tree] of Object.entries(launch.trees)) {
    if (state.repos[root]) state.repos[root].reviewed = tree;
  }
  return null;
}

function blockReason(files, changedLines) {
  return [
    `[review-gate] PR bloqueado: ${changedLines} linhas alteradas (git diff real) sem revisão independente.`,
    `Arquivos: ${files.join(', ')}`,
    '',
    'Antes de abrir o PR, obrigatoriamente:',
    `1. Chame o Agent com subagent_type "${REVIEWER}". O prompt deve citar esses arquivos, o pedido original do usuário (literal), o que você diz que fez e como diz que verificou. Não passe opinião sobre a qualidade.`,
    '2. O revisor precisa responder: o PR entrega o que foi pedido nesta sessão? Segue os padrões do projeto? Tem gambiarra, over engineering ou mudança que ninguém pediu?',
    '3. Não edite nada enquanto a revisão roda, senão ela é invalidada.',
    '4. Para cada achado blocker/major: corrija, ou refute com prova concreta.',
    '5. No corpo do PR e na resposta final, inclua a seção "Revisão independente": veredito, verificações executadas, achados e o destino de cada um.',
    'Se o usuário não quiser revisão, ele termina a mensagem com "sem review".',
  ].join('\n');
}

function stateDirectory() {
  return join(homedir(), '.cache', 'review-gate');
}

function stateFile(sessionId) {
  return join(stateDirectory(), `${String(sessionId).replace(/[^\w-]/g, '') || 'unknown'}.json`);
}

function lockIsStale(lock) {
  try {
    const age = Date.now() - statSync(lock).mtimeMs;
    const pid = Number(readFileSync(join(lock, 'pid'), 'utf-8'));
    if (!pid) return age > 2000;
    try {
      process.kill(pid, 0);
      return age > LOCK_STALE_MS;
    } catch (error) {
      return error.code === 'ESRCH' || age > LOCK_STALE_MS;
    }
  } catch {
    try {
      return Date.now() - statSync(lock).mtimeMs > 2000;
    } catch {
      return false;
    }
  }
}

export function acquireLock(sessionId, waitMs = LOCK_WAIT_MS) {
  const lock = `${stateFile(sessionId)}.lock`;
  mkdirSync(stateDirectory(), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'pid'), String(process.pid));
      return () => rmSync(lock, { recursive: true, force: true });
    } catch {
      if (lockIsStale(lock)) {
        const claimed = `${lock}.stale.${process.pid}`;
        try {
          renameSync(lock, claimed);
          rmSync(claimed, { recursive: true, force: true });
        } catch {
          sleep(5);
        }
        continue;
      }
      sleep(20);
    }
  }
  return null;
}

export function loadState(sessionId) {
  let text;
  try {
    text = readFileSync(stateFile(sessionId), 'utf-8');
  } catch {
    return emptyState();
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return normalizeState(parsed);
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function normalizeState(raw) {
  const state = emptyState();
  if (!isPlainObject(raw)) return state;
  if (isPlainObject(raw.repos)) state.repos = raw.repos;
  if (Array.isArray(raw.pending)) state.pending = raw.pending.filter((launch) => isPlainObject(launch) && isPlainObject(launch.trees) && typeof launch.launchedAt === 'number');
  if (typeof raw.skip === 'boolean') state.skip = raw.skip;
  if (isPlainObject(raw.unavailable)) state.unavailable = raw.unavailable;
  if (isPlainObject(raw.failedThisTurn)) state.failedThisTurn = raw.failedThisTurn;
  return state;
}

export function saveState(sessionId, state) {
  const target = stateFile(sessionId);
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporary, target);
}

const HANDLERS = { UserPromptSubmit: onUserPromptSubmit, PreToolUse: onPreToolUse, SubagentStop: onSubagentStop };

export function handle(payload, state, now = Date.now()) {
  const handler = HANDLERS[payload?.hook_event_name];
  if (!handler) return null;
  try {
    return handler(payload, state, now);
  } catch (error) {
    if (!isPullRequestCommand(payload)) return null;
    return { message: `[review-gate] Erro interno (${error instanceof Error ? error.message : String(error)}); o gate NÃO verificou este PR.` };
  }
}

export function render(result) {
  if (!result) return null;
  if (result.deny) return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: result.deny } };
  if (result.message) return { systemMessage: result.message };
  return null;
}

export function reviewerGuard(payload) {
  const violation = readOnlyViolation(payload.tool_name, payload.tool_input ?? {});
  return violation ? { deny: `[review-guard] Bloqueado (${violation}): o ${REVIEWER} é somente leitura.` } : null;
}

function emit(output) {
  if (output) process.stdout.write(JSON.stringify(output));
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return;
  }
  if (!payload?.session_id || !HANDLERS[payload.hook_event_name]) return;
  if (payload.hook_event_name === 'PreToolUse' && payload.agent_type === REVIEWER) {
    emit(render(reviewerGuard(payload)));
    return;
  }
  if (payload.agent_type && payload.hook_event_name !== 'SubagentStop' && payload.hook_event_name !== 'PreToolUse') return;

  const guarded = isPullRequestCommand(payload);
  let release;
  try {
    release = acquireLock(payload.session_id);
  } catch {
    release = null;
  }
  if (!release) {
    if (guarded) emit({ systemMessage: '[review-gate] Estado ocupado por outro hook; o gate não verificou este PR.' });
    return;
  }
  try {
    const state = loadState(payload.session_id);
    if (!state) {
      if (guarded) emit({ systemMessage: '[review-gate] Estado corrompido; o gate não verificou este PR.' });
      return;
    }
    const before = JSON.stringify(state);
    const output = render(handle(payload, state));
    if (JSON.stringify(state) !== before) saveState(payload.session_id, state);
    emit(output);
  } catch {
    if (guarded) emit({ systemMessage: '[review-gate] Erro interno; o gate não verificou este PR.' });
  } finally {
    try {
      release();
    } catch {
      release = null;
    }
  }
}

function invokedDirectly() {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
