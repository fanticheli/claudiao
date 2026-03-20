import type { PluginInfo } from '../types.js';

export const PLUGINS: PluginInfo[] = [
  {
    name: 'superpowers',
    description: 'TDD enforced (red-green-refactor), debugging sistematico em 4 fases, code review por severidade, git worktrees isolados, parallel agents',
    installCommand: 'claude /plugin install superpowers',
    repo: 'https://github.com/obra/superpowers',
    stars: '42k+',
  },
  {
    name: 'get-shit-done',
    description: 'Planejamento spec-driven com fases (discuss, plan, execute, verify), commits atomicos, milestones, e mapeamento de codebase existente',
    installCommand: 'npx get-shit-done-cc@latest',
    repo: 'https://github.com/gsd-build/get-shit-done',
  },
  {
    name: 'claude-mem',
    description: 'Memoria persistente entre sessoes. Captura decisoes, bugs resolvidos e contexto automaticamente via hooks. Armazena em SQLite + busca vetorial',
    installCommand: 'claude /plugin install claude-mem',
    repo: 'https://github.com/thedotmack/claude-mem',
  },
];

export function getPlugin(name: string): PluginInfo | undefined {
  return PLUGINS.find(p => p.name === name);
}
