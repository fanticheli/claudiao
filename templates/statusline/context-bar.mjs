#!/usr/bin/env node
// claudiao statusline — context-bar
// Renders: 📁 dir │ git-branch │ model │ [bar] N% │ $cost
// Reads the JSON schema from Claude Code 2.1.x stdin:
//   - context_window.used_percentage  (authoritative)
//   - context_window.current_usage + context_window_size  (fallback)
//   - cost.total_cost_usd  (session running total)

import { execSync } from 'node:child_process';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    const model = data.model?.display_name || data.model?.id || 'unknown';
    const cwd = data.workspace?.current_dir || data.cwd || process.cwd();
    const dirName = cwd.split('/').pop() || cwd;

    const pctUsed = computePctUsed(data.context_window);
    const bar = renderBar(pctUsed);
    const color = pickColor(pctUsed);

    let gitBranch = '';
    try {
      const branch = execSync('git branch --show-current', {
        cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      if (branch) gitBranch = ` ${DIM}│${RESET} ${branch}`;
    } catch {
      // not a git repo — skip
    }

    let costStr = '';
    const costUsd = data.cost?.total_cost_usd;
    if (typeof costUsd === 'number' && costUsd > 0) {
      costStr = ` ${DIM}│${RESET} ${DIM}$${costUsd.toFixed(2)}${RESET}`;
    }

    process.stdout.write(
      `${DIM}📁${RESET} ${dirName}${gitBranch} ${DIM}│${RESET} ${model} ${DIM}│${RESET} ${color}${bar}${RESET} ${color}${pctUsed}%${RESET}${costStr}`,
    );
  } catch {
    process.stdout.write('claude-code');
  }
});

function computePctUsed(cw) {
  if (typeof cw?.used_percentage === 'number') {
    return clampPct(cw.used_percentage);
  }
  if (cw?.context_window_size && cw?.current_usage) {
    const u = cw.current_usage;
    const total =
      (u.input_tokens || 0) +
      (u.output_tokens || 0) +
      (u.cache_creation_input_tokens || 0) +
      (u.cache_read_input_tokens || 0);
    return clampPct(Math.round((total / cw.context_window_size) * 100));
  }
  return 0;
}

function clampPct(n) {
  return Math.max(0, Math.min(100, n));
}

function renderBar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function pickColor(pct) {
  if (pct < 60) return GREEN;
  if (pct < 85) return YELLOW;
  return RED;
}
