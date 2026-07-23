import { readSettingsForWrite, writeSettings, type SettingsJson } from './hooks.js';

export type AttributionState = 'disabled' | 'enabled' | 'partial';

interface AttributionShape {
  commit?: unknown;
  pr?: unknown;
}

function attributionOf(settings: SettingsJson): AttributionShape {
  const raw = settings.attribution;
  return raw && typeof raw === 'object' ? (raw as AttributionShape) : {};
}

export function getAttributionState(settings: SettingsJson): AttributionState {
  const attr = attributionOf(settings);
  const commitOff = attr.commit === '';
  const prOff = attr.pr === '';
  const coAuthorOff = settings.includeCoAuthoredBy === false;

  if (commitOff && prOff && coAuthorOff) return 'disabled';
  if (!commitOff && !prOff && settings.includeCoAuthoredBy === undefined) return 'enabled';
  return 'partial';
}

export function applyDisable(settings: SettingsJson): SettingsJson {
  return {
    ...settings,
    attribution: { commit: '', pr: '' },
    includeCoAuthoredBy: false,
  };
}

export function applyEnable(settings: SettingsJson): SettingsJson {
  const next = { ...settings };
  delete next.attribution;
  delete next.includeCoAuthoredBy;
  return next;
}

export interface AttributionResult {
  changed: boolean;
  state: AttributionState;
}

export function disableAttribution(): AttributionResult {
  const settings = readSettingsForWrite();
  if (getAttributionState(settings) === 'disabled') {
    return { changed: false, state: 'disabled' };
  }
  writeSettings(applyDisable(settings));
  return { changed: true, state: 'disabled' };
}

export function enableAttribution(): AttributionResult {
  const settings = readSettingsForWrite();
  if (getAttributionState(settings) === 'enabled') {
    return { changed: false, state: 'enabled' };
  }
  writeSettings(applyEnable(settings));
  return { changed: true, state: 'enabled' };
}
