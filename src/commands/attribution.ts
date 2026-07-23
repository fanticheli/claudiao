import chalk from 'chalk';
import { readSettings, SETTINGS_FILE } from '../lib/hooks.js';
import {
  disableAttribution,
  enableAttribution,
  getAttributionState,
  type AttributionState,
} from '../lib/attribution.js';
import { banner, success, info, heading, dim, raw } from '../lib/format.js';

const STATE_LABEL: Record<AttributionState, string> = {
  disabled: chalk.green('desativada'),
  enabled: chalk.yellow('ativada (padrão do Claude Code)'),
  partial: chalk.yellow('parcial'),
};

export async function attributionOff(): Promise<void> {
  banner();
  heading('Desativando atribuição do Claude Code');
  dim('Remove "🤖 Generated with Claude Code" nos PRs e "Co-Authored-By: Claude" nos commits');
  raw('');

  const result = disableAttribution();
  if (result.changed) {
    success('Atribuição desativada em ~/.claude/settings.json');
    dim('attribution.commit = "", attribution.pr = "", includeCoAuthoredBy = false');
  } else {
    info('Atribuição já estava desativada');
  }
  raw('');
  dim('Jira, Slack e docs são cobertos pela regra no CLAUDE.md global, não por esta config.');
}

export async function attributionOn(): Promise<void> {
  banner();
  heading('Reativando atribuição do Claude Code');
  raw('');

  const result = enableAttribution();
  if (result.changed) {
    success('Atribuição reativada (removidas as chaves do settings.json)');
  } else {
    info('Atribuição já estava no padrão do Claude Code');
  }
}

export function attributionStatus(): void {
  banner();
  heading('Status da atribuição do Claude Code');
  raw('');

  const state = getAttributionState(readSettings());
  raw(`  Estado: ${STATE_LABEL[state]}`);
  dim(`  Config: ${SETTINGS_FILE}`);
  raw('');

  if (state !== 'disabled') {
    dim('Rode `claudiao attribution off` para desativar.');
  }
}
