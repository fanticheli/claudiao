import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock paths BEFORE importing remove.js so CLAUDE_COMMANDS_DIR lands in a
// tmp sandbox and the "remove source too?" flow points at a tmp repo.
vi.mock('../../lib/paths.js', () => ({
  CLAUDE_AGENTS_DIR: '',
  CLAUDE_SKILLS_DIR: '',
  get CLAUDE_COMMANDS_DIR() {
    return COMMANDS_DIR_OVERRIDE;
  },
  getAgentsSavePath: () => '',
  getCommandsSavePath: () => SAVE_PATH_OVERRIDE,
}));

const promptMock = vi.fn();
vi.mock('inquirer', () => ({
  default: {
    get prompt() {
      return promptMock;
    },
  },
}));

let COMMANDS_DIR_OVERRIDE = '';
let SAVE_PATH_OVERRIDE = '';
let tmpRoot: string;

const importRemove = async () => await import('../remove.js');

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'claudiao-remove-cmd-'));
  COMMANDS_DIR_OVERRIDE = join(tmpRoot, 'commands');
  SAVE_PATH_OVERRIDE = join(tmpRoot, 'repo-commands');
  mkdirSync(COMMANDS_DIR_OVERRIDE, { recursive: true });
  mkdirSync(SAVE_PATH_OVERRIDE, { recursive: true });
  promptMock.mockReset();
});

afterEach(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  vi.resetModules();
});

describe('removeCommand', () => {
  it('removes an installed symlink after confirmation, keeping the source', async () => {
    const source = join(SAVE_PATH_OVERRIDE, 'bug.md');
    const link = join(COMMANDS_DIR_OVERRIDE, 'bug.md');
    writeFileSync(source, '---\ndescription: x\n---\nbody');
    symlinkSync(source, link);

    promptMock
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ removeSource: false });

    const { removeCommand } = await importRemove();
    await removeCommand('bug');

    expect(existsSync(link)).toBe(false);
    expect(existsSync(source)).toBe(true);
  });

  it('also removes the source file when the user opts in', async () => {
    const source = join(SAVE_PATH_OVERRIDE, 'eod.md');
    const link = join(COMMANDS_DIR_OVERRIDE, 'eod.md');
    writeFileSync(source, '---\ndescription: x\n---\nbody');
    symlinkSync(source, link);

    promptMock
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ removeSource: true });

    const { removeCommand } = await importRemove();
    await removeCommand('eod');

    expect(existsSync(link)).toBe(false);
    expect(existsSync(source)).toBe(false);
  });

  it('removes a plain file (non-symlink) installed manually', async () => {
    const file = join(COMMANDS_DIR_OVERRIDE, 'manual.md');
    writeFileSync(file, '---\ndescription: x\n---\nbody');

    promptMock.mockResolvedValueOnce({ confirm: true });

    const { removeCommand } = await importRemove();
    await removeCommand('manual');

    expect(existsSync(file)).toBe(false);
  });

  it('does not touch anything when the user declines', async () => {
    const file = join(COMMANDS_DIR_OVERRIDE, 'keep.md');
    writeFileSync(file, '---\ndescription: x\n---\nbody');

    promptMock.mockResolvedValueOnce({ confirm: false });

    const { removeCommand } = await importRemove();
    await removeCommand('keep');

    expect(existsSync(file)).toBe(true);
  });

  it('does not touch anything in dry-run mode', async () => {
    const source = join(SAVE_PATH_OVERRIDE, 'dry.md');
    const link = join(COMMANDS_DIR_OVERRIDE, 'dry.md');
    writeFileSync(source, '---\ndescription: x\n---\nbody');
    symlinkSync(source, link);

    promptMock.mockResolvedValueOnce({ confirm: true });

    const { removeCommand } = await importRemove();
    await removeCommand('dry', { dryRun: true });

    expect(existsSync(link)).toBe(true);
    expect(existsSync(source)).toBe(true);
  });

  it('reports an error (and prompts nothing) when the command does not exist', async () => {
    const { removeCommand } = await importRemove();
    await removeCommand('ghost');

    expect(promptMock).not.toHaveBeenCalled();
  });
});
