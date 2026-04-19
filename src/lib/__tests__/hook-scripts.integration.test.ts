import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { PACKAGE_ROOT } from '../paths.js';

const HOOKS_DIR = join(PACKAGE_ROOT, 'templates', 'hooks');

function runHook(script: string, payload: unknown): { stdout: string; status: number | null } {
  const result = spawnSync('node', [join(HOOKS_DIR, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
  });
  return { stdout: result.stdout, status: result.status };
}

function parseOutput(stdout: string): { additionalContext: string } | null {
  if (stdout.trim().length === 0) return null;
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  const context = parsed.hookSpecificOutput?.additionalContext;
  return context ? { additionalContext: context } : null;
}

describe('claudiao-security-reminder.mjs', () => {
  const SCRIPT = 'claudiao-security-reminder.mjs';

  it('emits reminder for endpoint-like paths', () => {
    const { stdout, status } = runHook(SCRIPT, {
      tool_input: { file_path: 'src/routes/user.ts' },
    });
    expect(status).toBe(0);
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('/security-checklist');
    expect(out?.additionalContext).toContain('src/routes/user.ts');
  });

  it('is silent for non-matching paths', () => {
    const { stdout, status } = runHook(SCRIPT, {
      tool_input: { file_path: 'README.md' },
    });
    expect(status).toBe(0);
    expect(parseOutput(stdout)).toBeNull();
  });

  it('is silent when payload lacks file_path', () => {
    const { stdout, status } = runHook(SCRIPT, { tool_input: {} });
    expect(status).toBe(0);
    expect(parseOutput(stdout)).toBeNull();
  });

  it('handles filenames with spaces and quotes safely', () => {
    const { stdout, status } = runHook(SCRIPT, {
      tool_input: { file_path: 'src/routes/with "quoted" and space.ts' },
    });
    expect(status).toBe(0);
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('with "quoted" and space.ts');
  });
});

describe('claudiao-ui-reminder.mjs', () => {
  const SCRIPT = 'claudiao-ui-reminder.mjs';

  it('emits reminder for .tsx components', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { file_path: 'src/components/Button.tsx' },
    });
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('/ui-review-checklist');
  });

  it('is silent for backend files', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { file_path: 'src/db/schema.ts' },
    });
    expect(parseOutput(stdout)).toBeNull();
  });
});

describe('claudiao-migration-reminder.mjs', () => {
  const SCRIPT = 'claudiao-migration-reminder.mjs';

  it('emits reminder for SQL files', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { file_path: 'db/migrations/001_add_timezone.sql' },
    });
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('/sql-templates');
  });

  it('emits reminder for alembic versions', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { file_path: 'app/alembic/versions/xyz.py' },
    });
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('/sql-templates');
  });

  it('is silent for regular files', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { file_path: 'src/utils/helper.ts' },
    });
    expect(parseOutput(stdout)).toBeNull();
  });
});

describe('claudiao-commit-reminder.mjs', () => {
  const SCRIPT = 'claudiao-commit-reminder.mjs';

  it('emits reminder for non-conventional commit', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { command: 'git commit -m "added stuff"' },
    });
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('conventional');
  });

  it('is silent for valid conventional commit', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { command: 'git commit -m "feat(auth): add OAuth2 login"' },
    });
    expect(parseOutput(stdout)).toBeNull();
  });

  it('is silent for valid scoped fix', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { command: 'git commit -m "fix(orders): resolve race condition"' },
    });
    expect(parseOutput(stdout)).toBeNull();
  });

  it('is silent for commands that are not git commit', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { command: 'ls -la' },
    });
    expect(parseOutput(stdout)).toBeNull();
  });

  it('handles single-quoted commit messages', () => {
    const { stdout } = runHook(SCRIPT, {
      tool_input: { command: "git commit -m 'broken message'" },
    });
    const out = parseOutput(stdout);
    expect(out?.additionalContext).toContain('conventional');
  });

  it('is silent for malformed JSON input', () => {
    const result = spawnSync('node', [join(HOOKS_DIR, SCRIPT)], {
      input: 'not json at all',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

describe('claudiao-pr-reminder.mjs', () => {
  const SCRIPT = 'claudiao-pr-reminder.mjs';

  it('is executable', () => {
    const mode = statSync(join(HOOKS_DIR, SCRIPT)).mode;
    // Owner execute bit set
    expect(mode & 0o100).toBe(0o100);
  });

  it('emits reminder via systemMessage when tool_use_count > 0', () => {
    const { stdout, status } = runHook(SCRIPT, {
      session_id: 'test',
      hook_event_name: 'Stop',
      tool_use_count: 5,
    });
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as {
      continue: boolean;
      systemMessage?: string;
      hookSpecificOutput?: unknown;
    };
    expect(parsed.continue).toBe(true);
    // Stop hooks must NOT use hookSpecificOutput (schema rejects it).
    expect(parsed.hookSpecificOutput).toBeUndefined();
    expect(parsed.systemMessage).toContain('/pr-template');
    expect(parsed.systemMessage).toContain('/security-checklist');
  });

  it('is quiet (no systemMessage) when tool_use_count is 0', () => {
    const { stdout, status } = runHook(SCRIPT, {
      session_id: 'test',
      hook_event_name: 'Stop',
      tool_use_count: 0,
    });
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as {
      continue: boolean;
      systemMessage?: unknown;
      hookSpecificOutput?: unknown;
    };
    expect(parsed.continue).toBe(true);
    expect(parsed.systemMessage).toBeUndefined();
    expect(parsed.hookSpecificOutput).toBeUndefined();
  });

  it('reminds when has_edits=true', () => {
    const { stdout } = runHook(SCRIPT, { has_edits: true });
    const parsed = JSON.parse(stdout) as { systemMessage?: string };
    expect(parsed.systemMessage).toContain('/pr-template');
  });

  it('is quiet when has_edits=false', () => {
    const { stdout } = runHook(SCRIPT, { has_edits: false });
    const parsed = JSON.parse(stdout) as { systemMessage?: unknown };
    expect(parsed.systemMessage).toBeUndefined();
  });

  it('degrades to remind when payload has no detectable signal', () => {
    const { stdout } = runHook(SCRIPT, { session_id: 't', hook_event_name: 'Stop' });
    const parsed = JSON.parse(stdout) as { systemMessage?: string };
    expect(parsed.systemMessage).toContain('/pr-template');
  });

  it('does not crash on malformed stdin', () => {
    const result = spawnSync('node', [join(HOOKS_DIR, SCRIPT)], {
      input: '<<<not json>>>',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { continue: boolean };
    expect(parsed.continue).toBe(true);
  });

  it('parses transcript and reminds when Edit/Write tool_use is present', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'claudiao-pr-transcript-'));
    const transcriptPath = join(tmp, 'transcript.jsonl');
    const entries = [
      { type: 'user', message: { content: 'hi' } },
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Edit', input: {} }] },
      },
    ];
    writeFileSync(transcriptPath, entries.map((e) => JSON.stringify(e)).join('\n'));

    try {
      const { stdout } = runHook(SCRIPT, { transcript_path: transcriptPath });
      const parsed = JSON.parse(stdout) as { systemMessage?: string };
      expect(parsed.systemMessage).toContain('/pr-template');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('parses transcript and stays quiet when only reads happened', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'claudiao-pr-transcript-'));
    const transcriptPath = join(tmp, 'transcript.jsonl');
    const entries = [
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] },
      },
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Grep', input: {} }] },
      },
    ];
    writeFileSync(transcriptPath, entries.map((e) => JSON.stringify(e)).join('\n'));

    try {
      const { stdout } = runHook(SCRIPT, { transcript_path: transcriptPath });
      const parsed = JSON.parse(stdout) as { systemMessage?: unknown };
      expect(parsed.systemMessage).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('degrades to remind when transcript_path is unreadable', () => {
    const { stdout } = runHook(SCRIPT, {
      transcript_path: '/nonexistent/path/should/not/exist.jsonl',
    });
    const parsed = JSON.parse(stdout) as { systemMessage?: string };
    expect(parsed.systemMessage).toContain('/pr-template');
  });
});
