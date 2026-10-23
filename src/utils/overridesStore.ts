import { useSyncExternalStore } from 'react';
import {
  MILITIA_HP,
  MILITIA_DMG_MIN,
  MILITIA_DMG_MAX,
  RIDER_HP,
  RIDER_DMG_MIN,
  RIDER_DMG_MAX,
  UNIT_PRICE,
  RIDER_UNIT_PRICE,
  GARRISON_SLOT_CAPACITY,
  TILE_BASE_PRICE,
  TILE_BASE_UPGRADE,
  TILE_BASE_INCOME,
  ZOMBIE_HP,
  ZOMBIE_DMG_MIN,
  ZOMBIE_DMG_MAX,
  MONEY_PASS_START,
  UNITS_PASS_START,
} from '../game/constants';
import { isHeadlessRun } from './headlessStore';

/**
 * Live, tweakable game parameters (the ⚖️ Overrides screen). These shadow the
 * compile-time constants: game logic reads the current value through
 * `getOverrides()` instead of importing the constant directly, so a change
 * here takes effect across the whole running game immediately — no reload, no
 * new game. Persisted to localStorage so they survive turns and reloads, and
 * cleared by `resetOverrides()` when a new game starts.
 */
export interface GameOverrides {
  militiaHp: number;
  militiaDmgMin: number;
  militiaDmgMax: number;
  militiaPrice: number; // UNIT_PRICE
  riderHp: number;
  riderDmgMin: number;
  riderDmgMax: number;
  riderPrice: number; // RIDER_UNIT_PRICE
  garrisonSlotCapacity: number; // GARRISON_SLOT_CAPACITY (units per tile garrison slot)
  tileBasePrice: number; // TILE_BASE_PRICE
  tileUpgradeMult: number; // TILE_BASE_UPGRADE as a multiple of tileBasePrice
  tileIncomeMult: number; // TILE_BASE_INCOME as a multiple of tileBasePrice
  moneyPassStart: number; // MONEY_PASS_START
  unitsPassStart: number; // UNITS_PASS_START
  zombieHp: number; // ZOMBIE_HP (abandoned-tile guards -- own stats, not a multiple of militia's)
  zombieDmgMin: number; // ZOMBIE_DMG_MIN
  zombieDmgMax: number; // ZOMBIE_DMG_MAX
  stepByStepCombat: boolean; // battles start in manual step-by-step mode
  muteToasts: boolean; // suppress toast pop-ups (console + game log still fire)
  headlessCombats: boolean; // resolve every battle through the headless engine instead of showing BattleScreen
}

export const OVERRIDE_DEFAULTS: GameOverrides = {
  militiaHp: MILITIA_HP,
  militiaDmgMin: MILITIA_DMG_MIN,
  militiaDmgMax: MILITIA_DMG_MAX,
  militiaPrice: UNIT_PRICE,
  riderHp: RIDER_HP,
  riderDmgMin: RIDER_DMG_MIN,
  riderDmgMax: RIDER_DMG_MAX,
  riderPrice: RIDER_UNIT_PRICE,
  garrisonSlotCapacity: GARRISON_SLOT_CAPACITY,
  tileBasePrice: TILE_BASE_PRICE,
  // Constants derive UPGRADE/INCOME from PRICE, so the default multiples are
  // whatever ratio they currently hold (1 out of the box).
  tileUpgradeMult: TILE_BASE_UPGRADE / TILE_BASE_PRICE,
  tileIncomeMult: TILE_BASE_INCOME / TILE_BASE_PRICE,
  moneyPassStart: MONEY_PASS_START,
  unitsPassStart: UNITS_PASS_START,
  zombieHp: ZOMBIE_HP,
  zombieDmgMin: ZOMBIE_DMG_MIN,
  zombieDmgMax: ZOMBIE_DMG_MAX,
  stepByStepCombat: false,
  muteToasts: false,
  headlessCombats: false,
};

const STORAGE_KEY = 'game-overrides';

function sanitize(raw: Partial<GameOverrides> | null | undefined): GameOverrides {
  const merged = { ...OVERRIDE_DEFAULTS, ...(raw ?? {}) };
  const num = (v: unknown, fallback: number, min: number): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.max(min, n) : fallback;
  };

  return {
    militiaHp: num(merged.militiaHp, OVERRIDE_DEFAULTS.militiaHp, 1),
    militiaDmgMin: num(merged.militiaDmgMin, OVERRIDE_DEFAULTS.militiaDmgMin, 0),
    militiaDmgMax: num(merged.militiaDmgMax, OVERRIDE_DEFAULTS.militiaDmgMax, 0),
    militiaPrice: num(merged.militiaPrice, OVERRIDE_DEFAULTS.militiaPrice, 0),
    riderHp: num(merged.riderHp, OVERRIDE_DEFAULTS.riderHp, 1),
    riderDmgMin: num(merged.riderDmgMin, OVERRIDE_DEFAULTS.riderDmgMin, 0),
    riderDmgMax: num(merged.riderDmgMax, OVERRIDE_DEFAULTS.riderDmgMax, 0),
    riderPrice: num(merged.riderPrice, OVERRIDE_DEFAULTS.riderPrice, 0),
    garrisonSlotCapacity: Math.round(
      num(merged.garrisonSlotCapacity, OVERRIDE_DEFAULTS.garrisonSlotCapacity, 1)
    ),
    tileBasePrice: num(merged.tileBasePrice, OVERRIDE_DEFAULTS.tileBasePrice, 0),
    tileUpgradeMult: num(merged.tileUpgradeMult, OVERRIDE_DEFAULTS.tileUpgradeMult, 0),
    tileIncomeMult: num(merged.tileIncomeMult, OVERRIDE_DEFAULTS.tileIncomeMult, 0),
    moneyPassStart: num(merged.moneyPassStart, OVERRIDE_DEFAULTS.moneyPassStart, 0),
    unitsPassStart: num(merged.unitsPassStart, OVERRIDE_DEFAULTS.unitsPassStart, 0),
    zombieHp: num(merged.zombieHp, OVERRIDE_DEFAULTS.zombieHp, 1),
    zombieDmgMin: num(merged.zombieDmgMin, OVERRIDE_DEFAULTS.zombieDmgMin, 0),
    zombieDmgMax: num(merged.zombieDmgMax, OVERRIDE_DEFAULTS.zombieDmgMax, 0),
    stepByStepCombat: !!merged.stepByStepCombat,
    muteToasts: !!merged.muteToasts,
    headlessCombats: !!merged.headlessCombats,
  };
}

function load(): GameOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? (JSON.parse(raw) as Partial<GameOverrides>) : null);
  } catch {
    return { ...OVERRIDE_DEFAULTS };
  }
}

let current: GameOverrides = load();
const listeners = new Set<() => void>();

// A headless economy sim needs its own tile-price/income/pass-start knobs
// to test settings without touching the real game's live overrides -- this
// module-level `current` is a singleton, so writing to it directly while a
// real game is mounted would rescale its prices mid-sim, same class of leak
// gameEvent/screenStore/endTurnStore already had to be gated against.
let headlessOverrides: GameOverrides | null = null;

/** Sim-only overrides layer, read instead of `current` while isHeadlessRun()
 * is true. Pass null to clear it once the sim finishes. */
export function setHeadlessOverrides(patch: Partial<GameOverrides> | null): void {
  headlessOverrides = patch ? sanitize({ ...OVERRIDE_DEFAULTS, ...patch }) : null;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage unavailable (private mode etc.) — overrides still live in memory
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

/** Current live overrides — read this from game logic instead of the raw
 * constant so a mid-game tweak takes effect immediately. */
export function getOverrides(): GameOverrides {
  if (isHeadlessRun() && headlessOverrides) return headlessOverrides;
  return current;
}

/** Merge a partial update into the live overrides, persist, and notify. */
export function setOverrides(patch: Partial<GameOverrides>): void {
  current = sanitize({ ...current, ...patch });
  persist();
  emit();
}

/** Restore every override to its constant default (called when a new game
 * starts, so cheated parameters don't leak into a fresh game). */
export function resetOverrides(): void {
  current = { ...OVERRIDE_DEFAULTS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  emit();
}

/** React hook: re-renders the subscriber whenever any override changes. */
export function useOverrides(): GameOverrides {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );
}
