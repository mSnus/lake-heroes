import { useSyncExternalStore } from 'react';

/**
 * Persistent, user-facing app preferences (⚙️ Settings screen). Unlike
 * overridesStore (wiped by "New Game"/slot delete) and saveSlots (scoped to
 * one save), these survive page reload, a fresh game, AND switching save
 * slots -- a single raw localStorage key, same durability model as
 * i18n/languageStore.ts's 'language' key. No resetSettings() is exported on
 * purpose -- nothing should ever wipe this.
 */
export interface AppSettings {
  autoEndTurn: boolean;
  autoBattle: boolean;
  doNotDisplayBattles: boolean;
  mapAutoZoom: boolean;
  disableFog: boolean;
}

// autoEndTurn/mapAutoZoom default true (preserve today's always-on
// behavior); the rest default false (preserve today's behavior) unless
// explicitly opted in.
export const SETTINGS_DEFAULTS: AppSettings = {
  autoEndTurn: true,
  autoBattle: false,
  doNotDisplayBattles: false,
  mapAutoZoom: true,
  disableFog: false,
};

const STORAGE_KEY = 'app-settings';

function sanitize(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const merged = { ...SETTINGS_DEFAULTS, ...(raw ?? {}) };
  return {
    autoEndTurn: !!merged.autoEndTurn,
    autoBattle: !!merged.autoBattle,
    doNotDisplayBattles: !!merged.doNotDisplayBattles,
    mapAutoZoom: !!merged.mapAutoZoom,
    disableFog: !!merged.disableFog,
  };
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? (JSON.parse(raw) as Partial<AppSettings>) : null);
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

let current: AppSettings = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage unavailable -- settings still live in memory for this session
  }
}

export function getSettings(): AppSettings {
  return current;
}

/** Merge a partial update into live settings, persist, and notify --
 * callers (the Settings screen's checkboxes) commit on every toggle, no
 * separate Apply button, since these are simple independent booleans. */
export function setSettings(patch: Partial<AppSettings>): void {
  current = sanitize({ ...current, ...patch });
  persist();
  listeners.forEach((l) => l());
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );
}
