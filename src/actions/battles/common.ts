import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { BRAWL_THRESHOLD } from '../../game/constants';

export type BattleOutcome = 'attacker' | 'defender' | 'tie';

/**
 * A brawl (manual, one duel at a time, rightmost attacker vs leftmost
 * defender each round) requires BOTH a small defence and a small attacking
 * force — a big army attacking a weakly-defended tile or caravan fights a
 * normal automatic battle (random pairs) instead.
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
