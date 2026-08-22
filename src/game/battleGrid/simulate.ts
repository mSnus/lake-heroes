import { BATTLEFIELD_COLS, BATTLEFIELD_ROWS, BRAWL_THRESHOLD, BRAWL_COLS, BRAWL_ROWS } from '../constants';
import { createBattle, isBattleOver, stepTurn, planBrawlSide, applyBrawlMoves, resolveBrawlCombat } from './engine';
import { sizeArmyForGrid } from './scale';
import { GridBattleState, StepTurnOptions } from './types';

export interface SimAttacker {
  militia: number;
  riders: number;
  militiaHp: number;
  militiaDmgMin: number;
  militiaDmgMax: number;
  riderHp: number;
  riderDmgMin: number;
  riderDmgMax: number;
}

export type SimDefenderKind = 'normal' | 'zombie' | 'dragon';

export interface SimDefender {
  amount: number;
  kind: SimDefenderKind;
  hp: number;
  dmgMin: number;
  dmgMax: number;
}

export interface SimResult {
  attackerLost: number;
  defenderLost: number;
  outcome: GridBattleState['status'];
}

// Same battle can't run forever -- a real fight always ends well before this.
const MAX_ROUNDS = 300;

/**
 * One full battle, resolved with the same engine real gameplay uses --
 * createBattle, then either the brawl move/fight loop or stepTurn, picked
 * the same way BattleScreen.tsx does (both sides at or below BRAWL_THRESHOLD
 * -> brawl). Used by the battle simulator screen to run repeated trials of a
 * hypothetical matchup without touching any real GameState.
 */
export function simulateOneBattle(
  attacker: SimAttacker,
  defender: SimDefender,
  defenderPctBonus: number
): SimResult {
  const atk = sizeArmyForGrid(attacker.militia, attacker.riders);
  const isDragon = defender.kind === 'dragon';
  const def = sizeArmyForGrid(isDragon ? 0 : defender.amount, isDragon ? defender.amount : 0);
  const attackerTotal = atk.militiaCount + atk.ridersCount;
  const defenderTotal = def.militiaCount + def.ridersCount;
  const isBrawl = attackerTotal <= BRAWL_THRESHOLD && defenderTotal <= BRAWL_THRESHOLD;
  const cols = isBrawl ? BRAWL_COLS : BATTLEFIELD_COLS;
  const rows = isBrawl ? BRAWL_ROWS : BATTLEFIELD_ROWS;

  let state: GridBattleState = createBattle(
    {
      militia: atk.militiaCount,
      riders: atk.ridersCount,
      formation: { kind: 'compact' },
      militiaHp: attacker.militiaHp,
      militiaDmgMin: attacker.militiaDmgMin,
      militiaDmgMax: attacker.militiaDmgMax,
      riderHp: attacker.riderHp,
      riderDmgMin: attacker.riderDmgMin,
      riderDmgMax: attacker.riderDmgMax,
    },
    {
      militia: def.militiaCount,
      riders: def.ridersCount,
      formation: { kind: isDragon ? 'dragon' : 'compact' },
      zombie: defender.kind === 'zombie',
      // The defender is always a single kind at a time -- its custom stats
      // land in whichever slot (militia or rider) that kind actually uses
      // (see createBattle: dragon-formation sides get their headcount via
      // the rider slot).
      ...(isDragon
        ? { riderHp: defender.hp, riderDmgMin: defender.dmgMin, riderDmgMax: defender.dmgMax }
        : { militiaHp: defender.hp, militiaDmgMin: defender.dmgMin, militiaDmgMax: defender.dmgMax }),
    },
    cols,
    rows
  );

  const opts: StepTurnOptions = { defenderPctBonus };
  let rounds = 0;
  if (isBrawl) {
    while (!isBattleOver(state) && rounds < MAX_ROUNDS) {
      rounds++;
      const startPos = new Map(state.units.map((u) => [u.id, { col: u.col, row: u.row }]));
      const defMoved = applyBrawlMoves(state, planBrawlSide(state, 'defender', Math.random));
      const atkMoved = applyBrawlMoves(defMoved, planBrawlSide(defMoved, 'attacker', Math.random));
      const movedIds = new Set<string>();
      for (const u of atkMoved.units) {
        const p = startPos.get(u.id);
        if (!p || p.col !== u.col || p.row !== u.row) movedIds.add(u.id);
      }
      state = resolveBrawlCombat(atkMoved, opts, movedIds, undefined).state;
    }
  } else {
    while (!isBattleOver(state) && rounds < MAX_ROUNDS) {
      rounds++;
      state = stepTurn(state, opts).state;
    }
  }

  const attackerLeft = state.units.filter((u) => u.side === 'attacker').length;
  const defenderLeft = state.units.filter((u) => u.side === 'defender').length;
  return {
    attackerLost: attackerTotal - attackerLeft,
    defenderLost: defenderTotal - defenderLeft,
    outcome: state.status,
  };
}

export function runBattleSimulations(
  attacker: SimAttacker,
  defender: SimDefender,
  defenderPctBonus: number,
  runs: number = 100
): SimResult[] {
  return Array.from({ length: runs }, () => simulateOneBattle(attacker, defender, defenderPctBonus));
}

/** Nearest-rank percentile of attacker losses across a batch of results. */
export function attackerLossPercentile(results: SimResult[], p: number): number {
  const sorted = [...results].map((r) => r.attackerLost).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}
