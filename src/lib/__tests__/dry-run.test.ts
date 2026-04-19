import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dryRunnable } from '../dry-run.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('dryRunnable', () => {
  it('runs the action when dryRun is false and returns its result', () => {
    const action = vi.fn().mockReturnValue('real');
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = dryRunnable({ dryRun: false }, action, 'would do the thing');
    expect(action).toHaveBeenCalledOnce();
    expect(result).toBe('real');
    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it('skips the action when dryRun is true and returns undefined', () => {
    const action = vi.fn().mockReturnValue('real');
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = dryRunnable({ dryRun: true }, action, 'would do the thing');
    expect(action).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    expect(infoSpy).toHaveBeenCalled();
    const msg = String(infoSpy.mock.calls[0]?.[0] ?? '');
    expect(msg).toContain('[dry-run]');
    expect(msg).toContain('would do the thing');
    infoSpy.mockRestore();
  });

  it('propagates exceptions from the action when dryRun is false', () => {
    const boom = new Error('kaboom');
    const action = vi.fn(() => {
      throw boom;
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => dryRunnable({ dryRun: false }, action, 'noop')).toThrow('kaboom');
  });

  it('supports sync actions returning number', () => {
    const action = () => 42;
    const result = dryRunnable({ dryRun: false }, action, 'msg');
    expect(result).toBe(42);
  });
});
