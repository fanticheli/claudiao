import { describe, it, expect } from 'vitest';
import {
  applyDisable,
  applyEnable,
  getAttributionState,
} from '../attribution.js';
import type { SettingsJson } from '../hooks.js';

describe('getAttributionState', () => {
  it('reports enabled for a fresh settings object', () => {
    expect(getAttributionState({})).toBe('enabled');
  });

  it('reports disabled when all three signals are off', () => {
    const settings: SettingsJson = {
      attribution: { commit: '', pr: '' },
      includeCoAuthoredBy: false,
    };
    expect(getAttributionState(settings)).toBe('disabled');
  });

  it('reports partial when only commit is silenced', () => {
    const settings: SettingsJson = { attribution: { commit: '', pr: 'x' } };
    expect(getAttributionState(settings)).toBe('partial');
  });

  it('reports partial when only includeCoAuthoredBy is set', () => {
    expect(getAttributionState({ includeCoAuthoredBy: false })).toBe('partial');
  });
});

describe('applyDisable', () => {
  it('sets all three keys and preserves unrelated settings', () => {
    const before: SettingsJson = { hooks: {}, permissions: { allow: ['x'] } };
    const after = applyDisable(before);
    expect(after.attribution).toEqual({ commit: '', pr: '' });
    expect(after.includeCoAuthoredBy).toBe(false);
    expect(after.permissions).toEqual({ allow: ['x'] });
    expect(after.hooks).toEqual({});
  });

  it('is idempotent', () => {
    expect(applyDisable(applyDisable({}))).toEqual(applyDisable({}));
  });

  it('does not mutate the input', () => {
    const before: SettingsJson = {};
    applyDisable(before);
    expect(before.attribution).toBeUndefined();
  });

  it('produces a disabled state', () => {
    expect(getAttributionState(applyDisable({}))).toBe('disabled');
  });
});

describe('applyEnable', () => {
  it('removes both attribution keys and preserves the rest', () => {
    const before: SettingsJson = {
      attribution: { commit: '', pr: '' },
      includeCoAuthoredBy: false,
      permissions: { allow: ['y'] },
    };
    const after = applyEnable(before);
    expect(after.attribution).toBeUndefined();
    expect(after.includeCoAuthoredBy).toBeUndefined();
    expect(after.permissions).toEqual({ allow: ['y'] });
    expect(getAttributionState(after)).toBe('enabled');
  });

  it('does not mutate the input', () => {
    const before: SettingsJson = { attribution: { commit: '', pr: '' } };
    applyEnable(before);
    expect(before.attribution).toEqual({ commit: '', pr: '' });
  });
});
