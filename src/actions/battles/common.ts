import { Player } from '../../game/Player';
import { say } from '../../utils/say';

export type RoundWinner = 'attacker' | 'defender' | 'tie';

export type RoundResult = {
  attackerRoll: number;
  defenderRoll: number;
  winner: RoundWinner;
};

export type BattleOutcome = 'attacker' | 'defender' | 'tie';

export interface BattleResolution {
  outcome: BattleOutcome;
  /** Message shown on the battle result screen. */
  message: string;
  /** Whether to fade in the victory / lost background. */
  victoryBg?: boolean;
  lostBg?: boolean;
}

/** Number of rounds a force of the given size fights. */
export function roundCount(defence: number): number {
  return Math.max(1, Math.ceil(defence / 6));
}

/** The side that won the most rounds; equal rounds is a tie. */
export function determineBattleOutcome(results: RoundResult[]): BattleOutcome {
  const aWins = results.filter((r) => r.winner === 'attacker').length;
  const dWins = results.filter((r) => r.winner === 'defender').length;
  if (aWins > dWins) return 'attacker';
  if (dWins > aWins) return 'defender';
  return 'tie';
}

/**
 * Per-round unit attrition: the attacker loses `round(defence/totalRounds)`
 * units for every round the defender won.
 */
export function perRoundUnitLoss(
  defence: number,
  totalRounds: number,
  results: RoundResult[]
): number {
  const unitsPerRound = Math.max(1, Math.round(defence / totalRounds));
  const roundsLost = results.filter((r) => r.winner === 'defender').length;
  return roundsLost * unitsPerRound;
}

/** Single summary log line for a resolved battle, from the attacker's view. */
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
