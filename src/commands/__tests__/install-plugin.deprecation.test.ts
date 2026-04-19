import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('installPlugin deprecation (v1.4.0)', () => {
  const warnSpy = vi.fn();
  const infoSpy = vi.fn();
  const rawSpy = vi.fn();
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
    throw new Error('__exit__');
  }) as never);

  beforeEach(() => {
    vi.resetModules();
    warnSpy.mockReset();
    infoSpy.mockReset();
    rawSpy.mockReset();
    exitSpy.mockClear();

    vi.doMock('../../lib/format.js', () => ({
      output: {
        warn: warnSpy,
        info: infoSpy,
        raw: rawSpy,
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('../../lib/format.js');
  });

  it('exits with code 1', async () => {
    const { installPlugin } = await import('../install-plugin.js');
    expect(() => installPlugin('superpowers')).toThrow('__exit__');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('mentions "removido" in the warning', async () => {
    const { installPlugin } = await import('../install-plugin.js');
    expect(() => installPlugin('any')).toThrow('__exit__');
    const warnMsg = warnSpy.mock.calls[0]?.[0] as string;
    expect(warnMsg).toMatch(/removido/i);
    expect(warnMsg).toMatch(/v1\.4\.0/);
  });

  it('points user to claude /plugin install', async () => {
    const { installPlugin } = await import('../install-plugin.js');
    expect(() => installPlugin()).toThrow('__exit__');
    const allCalls = [
      ...infoSpy.mock.calls.map((c) => c[0]),
      ...rawSpy.mock.calls.map((c) => c[0]),
    ].join(' ');
    expect(allCalls).toMatch(/claude \/plugin install/);
  });
});
