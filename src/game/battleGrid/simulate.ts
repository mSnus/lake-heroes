import { createBattle, isBattleOver, stepTurn, planBrawlSide, applyBrawlMoves, resolveBrawlCombat } from './engine';
import { sizeArmyForGrid } from './scale';
import { battleBoardFor, squadGroupCount } from './layout';
import { FormationSpec } from './formations';
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
  attackerTotal: number;
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
  // Dragons line up in a normal grouped formation now, not the old fixed
  // 50-cell silhouette, so any headcount works -- take it from the input.
  const defenderRaw = defender.amount;
  const def = sizeArmyForGrid(isDragon ? 0 : defenderRaw, isDragon ? defenderRaw : 0);
  const attackerTotal = atk.militiaCount + atk.ridersCount;
  const defenderTotal = def.militiaCount + def.ridersCount;
  // Board tier and formations both come from the same helpers the live
  // battle screen uses, so simulated odds match what a real fight of these
  // exact parameters would produce -- see layout.ts.
  const { isBrawl, cols, rows } = battleBoardFor(attackerTotal, defenderTotal);
  const attackerFormation: FormationSpec = isBrawl
    ? { kind: 'compact' }
    : { kind: 'grouped', groupCount: squadGroupCount(attacker.militia, attacker.riders) };
  const defenderFormation: FormationSpec = isBrawl
    ? { kind: 'compact' }
    : { kind: 'grouped', groupCount: squadGroupCount(isDragon ? 0 : defenderRaw, isDragon ? defenderRaw : 0) };

  let state: GridBattleState = createBattle(
    {
      militia: atk.militiaCount,
      riders: atk.ridersCount,
      formation: attackerFormation,
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
      formation: defenderFormation,
      dragon: isDragon,
      zombie: defender.kind === 'zombie',
      // The defender is always a single kind at a time -- its custom stats
      // land in whichever slot (militia or rider) that kind actually uses
      // (see createBattle: dragon-formation sides get their headcount via
      // the rider slot). A 'normal' defender is genuinely the same militia
      // kind as the attacker's own -- its own hp/dmg inputs are ignored
      // entirely, sharing the attacker's militia stats instead, same as
      // real militia everywhere in the actual game.
      ...(isDragon
        ? { riderHp: defender.hp, riderDmgMin: defender.dmgMin, riderDmgMax: defender.dmgMax }
        : defender.kind === 'normal'
          ? { militiaHp: attacker.militiaHp, militiaDmgMin: attacker.militiaDmgMin, militiaDmgMax: attacker.militiaDmgMax }
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
    attackerTotal,
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

/** % of runs where the attacker lost less than `threshold` of its own army. */
export function lightLossRate(results: SimResult[], threshold: number = 0.2): number {
  if (results.length === 0) return 0;
  const count = results.filter((r) => r.attackerLost < r.attackerTotal * threshold).length;
  return Math.round((count / results.length) * 100);
}
