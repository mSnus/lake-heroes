import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { BRAWL_THRESHOLD } from '../../game/constants';

export type BattleOutcome = 'attacker' | 'defender' | 'tie';

/**
 * A brawl (single winner-take-all roll-off) requires BOTH a small defence
 * and a small attacking force — a big army attacking a weakly-defended tile
 * or caravan fights a normal multi-round battle instead.
 */
export function isBrawlMatchup(defence: number, attackerUnits: number): boolean {
  return defence <= BRAWL_THRESHOLD && attackerUnits <= BRAWL_THRESHOLD;
}

export interface RoundResult {
  attackerRoll: number;
  defenderRoll: number;
  /** Attacker units killed this round (by defender's roll). */
  attackerKilled: number;
  /** Defender units killed this round (by attacker's roll). */
  defenderKilled: number;
}

export interface BattleResolution {
  outcome: BattleOutcome;
  message: string;
  victoryBg?: boolean;
  lostBg?: boolean;
}

export interface BrawlRound {
  defKills: number;
  atkKills: number;
  newDefLeft: number;
  newAtkLeft: number;
}

/**
 * Resolve one brawl round: higher roll wipes the loser's side; tie retains both counts.
 * `units` is the starting unit count for both sides (brawl grids are always symmetric).
 */
export function computeBrawlRound(
  aRoll: number,
  dRoll: number,
  units: number,
  currentDefLeft: number,
  currentAtkLeft: number
): BrawlRound {
  if (aRoll > dRoll) {
    return { defKills: units, atkKills: 0, newDefLeft: 0, newAtkLeft: units };
  } else if (dRoll > aRoll) {
    return { defKills: 0, atkKills: units, newDefLeft: units, newAtkLeft: 0 };
  } else {
    return { defKills: 0, atkKills: 0, newDefLeft: currentDefLeft, newAtkLeft: currentAtkLeft };
  }
}

/**
 * A side with a big enough army relative to its opponent's force fights
 * smarter: +1 to every roll at 2x the opponent's size, +2 at 4x or more.
 */
export function rollBonus(ownUnits: number, opposingUnits: number): number {
  if (opposingUnits <= 0) return 0;
  const ratio = ownUnits / opposingUnits;
  if (ratio >= 4) return 2;
  if (ratio >= 2) return 1;
  return 0;
}

export function lossStr(gold: number, units: number): string {
  const parts = [...(gold > 0 ? [`${gold}🟡`] : []), ...(units > 0 ? [`${units}🧍`] : [])];
  return parts.join(' and ');
}

export function logBattleSummary(
  attacker: Player,
  defenderLabel: string,
  outcome: BattleOutcome,
  capturedTileName: string | null,
  unitsBefore: number,
  goldBefore: number,
  claimed: boolean = false
): void {
  const unitsAfter = attacker.units;
  const goldAfter = attacker.gold;
  const unitDiff = unitsBefore - unitsAfter;
  const goldDiff = goldAfter - goldBefore;

  if (outcome === 'attacker' && claimed && capturedTileName) {
    const unitsPart = unitDiff > 0 ? ` losing ${unitDiff}🧍` : '';
    const paidPart = goldDiff < 0 ? ` and paid ${-goldDiff}🟡 to own it` : '';
    say(
      `⚔️ ${attacker.name} won the battle for ${capturedTileName}${unitsPart}${paidPart}`,
      'success'
    );
    return;
  }

  const outcomeVerb =
    outcome === 'attacker' ? 'wins a battle' : outcome === 'defender' ? 'loses a battle' : 'ties';
  const capturePart =
    outcome === 'attacker' && capturedTileName ? `, razed ${capturedTileName}` : '';
  const unitsPart =
    unitDiff > 0
      ? `, lost ${unitDiff}🧍 (${unitsBefore}→${unitsAfter})`
      : unitDiff < 0
        ? `, gained ${-unitDiff}🧍 (${unitsBefore}→${unitsAfter})`
        : '';
  const goldPart =
    goldDiff > 0
      ? `, gained ${goldDiff}🟡`
      : goldDiff < 0
        ? `, lost ${-goldDiff}🟡 (${goldBefore}→${goldAfter})`
        : '';
  const logLevel = outcome === 'attacker' ? 'success' : outcome === 'defender' ? 'error' : 'info';
  say(
    `⚔️ ${attacker.name} ${outcomeVerb} with ${defenderLabel}${capturePart}${unitsPart}${goldPart}`,
    logLevel
  );
}
