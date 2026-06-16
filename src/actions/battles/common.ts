import { Player } from '../../game/Player';
import { say } from '../../utils/say';

export type BattleOutcome = 'attacker' | 'defender' | 'tie';

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
  goldBefore: number
): void {
  const outcomeVerb =
    outcome === 'attacker' ? 'wins a battle' : outcome === 'defender' ? 'loses a battle' : 'ties';
  const capturePart =
    outcome === 'attacker' && capturedTileName ? `, razed ${capturedTileName}` : '';
  const unitsAfter = attacker.units;
  const goldAfter = attacker.gold;
  const unitDiff = unitsBefore - unitsAfter;
  const goldDiff = goldAfter - goldBefore;
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
