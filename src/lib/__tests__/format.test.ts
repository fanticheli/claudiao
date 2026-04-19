import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We re-import fresh on every test to reset module-level state.
async function freshFormat() {
  vi.resetModules();
  return await import('../format.js');
}

const originalDebugEnv = process.env.CLAUDIAO_DEBUG;

beforeEach(() => {
  delete process.env.CLAUDIAO_DEBUG;
});

afterEach(() => {
  if (originalDebugEnv === undefined) {
    delete process.env.CLAUDIAO_DEBUG;
  } else {
    process.env.CLAUDIAO_DEBUG = originalDebugEnv;
  }
});

describe('verbose mode', () => {
  it('is off by default', async () => {
    const { isVerbose } = await freshFormat();
    expect(isVerbose()).toBe(false);
  });

  it('setVerbose(true) enables debug()', async () => {
    const { setVerbose, debug, isVerbose } = await freshFormat();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setVerbose(true);
    expect(isVerbose()).toBe(true);
    debug('hello');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[debug] hello'));
    spy.mockRestore();
  });

  it('debug() is silent when verbose is off', async () => {
    const { debug } = await freshFormat();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('CLAUDIAO_DEBUG=1 env var activates verbose at import time', async () => {
    process.env.CLAUDIAO_DEBUG = '1';
    const { isVerbose, debug } = await freshFormat();
    expect(isVerbose()).toBe(true);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debug('env-enabled');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[debug] env-enabled'));
    spy.mockRestore();
  });

  it('CLAUDIAO_DEBUG=true also activates verbose', async () => {
    process.env.CLAUDIAO_DEBUG = 'true';
    const { isVerbose } = await freshFormat();
    expect(isVerbose()).toBe(true);
  });

  it('env var prevents setVerbose(false) from disabling debug', async () => {
    process.env.CLAUDIAO_DEBUG = '1';
    const { setVerbose, isVerbose } = await freshFormat();
    setVerbose(false); // Should still be on because env var wins
    expect(isVerbose()).toBe(true);
  });
});

describe('quiet mode', () => {
  it('suppresses info/success/warn/dim', async () => {
    const { setQuiet, info, success, warn, dim } = await freshFormat();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setQuiet(true);

    info('info');
    success('success');
    warn('warn');
    dim('dim');

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('still emits error() in quiet mode', async () => {
    const { setQuiet, error } = await freshFormat();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setQuiet(true);
    error('something broke');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('json mode', () => {
  it('suppresses info/success/warn and routes error to stderr', async () => {
    const { setJsonMode, info, success, error } = await freshFormat();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setJsonMode(true);

    info('noise');
    success('more noise');
    error('real problem');

    // only error went to stderr; stdout stayed clean (no log calls)
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('real problem'));
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('json() always writes to stdout regardless of quiet/json flags', async () => {
    const { setJsonMode, setQuiet, json } = await freshFormat();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setJsonMode(true);
    setQuiet(true);
    json({ hello: 'world' });
    expect(spy).toHaveBeenCalledWith('{"hello":"world"}');
    spy.mockRestore();
  });
});

describe('output namespace', () => {
  it('exposes every primitive', async () => {
    const { output } = await freshFormat();
    expect(typeof output.info).toBe('function');
    expect(typeof output.success).toBe('function');
    expect(typeof output.warn).toBe('function');
    expect(typeof output.error).toBe('function');
    expect(typeof output.debug).toBe('function');
    expect(typeof output.raw).toBe('function');
    expect(typeof output.table).toBe('function');
    expect(typeof output.json).toBe('function');
    expect(typeof output.banner).toBe('function');
    expect(typeof output.dim).toBe('function');
    expect(typeof output.heading).toBe('function');
    expect(typeof output.separator).toBe('function');
  });
});
