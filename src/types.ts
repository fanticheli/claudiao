export interface AgentMeta {
  name: string;
  description: string;
  tools: string[];
  model: string;
  category?: string;
}

export interface SkillMeta {
  name: string;
  description: string;
  allowedTools: string[];
  model: string;
}

export interface PluginInfo {
  name: string;
  description: string;
  installCommand: string;
  repo: string;
  stars?: string;
}

export interface ClaudiaoConfig {
  repoPath?: string;
  installedAt: string;
  version: string;
}
