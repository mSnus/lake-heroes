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
