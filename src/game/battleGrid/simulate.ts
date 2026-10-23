import { createBattle, runGridBattleToCompletion, sideRemaining } from './engine';
import { sizeArmyForGrid } from './scale';
import { GridBattleState, StepTurnOptions } from './types';
import { ABSORB_PER_ROLL_POINT } from '../constants';

export interface SimAttacker {
  militia: number;
  riders: number;
  militiaHp: number;
  militiaDmgMin: number;
  militiaDmgMax: number;
  riderHp: number;
  riderDmgMin: number;
  riderDmgMax: number;
  /** Flat bonus added to every attacker roll -- what artifacts grant in a
   * real fight (see getArtifactRollBonus). Omit for an unequipped player. */
  flatBonus?: number;
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

/**
 * One full battle, resolved with the same engine real gameplay uses --
 * createBattle, then the same round loop BattleScreen.tsx plays. Used by the
 * battle simulator screen to run repeated trials of a hypothetical matchup
 * without touching any real GameState.
 */
export function simulateOneBattle(
  attacker: SimAttacker,
  defender: SimDefender,
  defenderPctBonus: number
): SimResult {
  const atk = sizeArmyForGrid(attacker.militia, attacker.riders);
  const isDragon = defender.kind === 'dragon';
  const defenderRaw = defender.amount;
  const def = sizeArmyForGrid(isDragon ? 0 : defenderRaw, isDragon ? defenderRaw : 0);
  const attackerTotal = atk.militiaCount + atk.ridersCount;
  const defenderTotal = def.militiaCount + def.ridersCount;

  let state: GridBattleState = createBattle(
    {
      militia: atk.militiaCount,
      riders: atk.ridersCount,
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
      dragon: isDragon,
      zombie: defender.kind === 'zombie',
      // The defender is always a single kind at a time -- its custom stats
      // land in whichever slot (militia or rider) that kind actually uses
      // (see createBattle: a dragon side gets its headcount via the rider
      // slot). A 'normal' defender is genuinely the same militia
      // kind as the attacker's own -- its own hp/dmg inputs are ignored
      // entirely, sharing the attacker's militia stats instead, same as
      // real militia everywhere in the actual game.
      ...(isDragon
        ? { riderHp: defender.hp, riderDmgMin: defender.dmgMin, riderDmgMax: defender.dmgMax }
        : defender.kind === 'normal'
          ? { militiaHp: attacker.militiaHp, militiaDmgMin: attacker.militiaDmgMin, militiaDmgMax: attacker.militiaDmgMax }
          : { militiaHp: defender.hp, militiaDmgMin: defender.dmgMin, militiaDmgMax: defender.dmgMax }),
    }
  );

  // The sim screen's defence input is a percentage; each point of the
  // absorption roll is worth ABSORB_PER_ROLL_POINT of a hit.
  const opts: StepTurnOptions = {
    defenderAbsorbBonus: Math.round(defenderPctBonus / ABSORB_PER_ROLL_POINT),
    attackerFlatBonus: attacker.flatBonus ?? 0,
  };
  state = runGridBattleToCompletion(state, opts);

  const attackerLeft = sideRemaining(state, 'attacker');
  const defenderLeft = sideRemaining(state, 'defender');
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

