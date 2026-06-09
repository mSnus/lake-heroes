import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { RoundResult } from './common';

export type AmbushOutcome = 'win' | 'defeat' | 'tie';

export interface AmbushResolution {
  outcome: AmbushOutcome;
  message: string;
}

const GOLD_PER_KILL = 200;

/**
 * Apply the outcome of an ambush (the game attacks the player) and return the
 * result screen message. Mutates the player's gold/units directly.
 *
 * - Win: 200🟡 per enemy unit killed (per-round rule), and the player still
 *   loses units for every round the ambushers won (per-round rule).
 * - Tie: the player loses 50% of the ambushers' units.
 * - Defeat: the player loses units equal to the ambushers' force (100%) plus
 *   20–30% of their gold.
 */
export function resolveAmbush(
  board: GameState,
  player: Player,
  attackerUnits: number,
  totalRounds: number,
  results: RoundResult[]
): AmbushResolution {
  const perRound = Math.max(1, Math.round(attackerUnits / totalRounds));
  const roundsWonByPlayer = results.filter((r) => r.winner === 'defender').length;
  const roundsWonByAttacker = results.filter((r) => r.winner === 'attacker').length;

  const outcome: AmbushOutcome =
    roundsWonByPlayer > roundsWonByAttacker
      ? 'win'
      : roundsWonByAttacker > roundsWonByPlayer
        ? 'defeat'
        : 'tie';

  let message = '';
  const goldBefore = player.gold;
  const unitsBefore = player.units;

  if (outcome === 'win') {
    const killed = roundsWonByPlayer * perRound;
    const reward = killed * GOLD_PER_KILL;
    const unitLoss = Math.min(player.units, roundsWonByAttacker * perRound);

    player.gold += reward;
    player.units = Math.max(0, player.units - unitLoss);

    const lossStr = unitLoss > 0 ? `, losing ${unitLoss}🧍` : '';
    board.gameMessage = `${player.name} repels the ambush, slaying ${killed}🧍 for ${reward}🟡${lossStr}`;
    message = `Ambush repelled! Slew ${killed}🧍 for ${reward}🟡${lossStr}`;
  } else if (outcome === 'tie') {
    const unitLoss = Math.min(player.units, Math.floor(attackerUnits * 0.5));
    player.units = Math.max(0, player.units - unitLoss);

    board.gameMessage = `${player.name} barely survives the ambush, losing ${unitLoss}🧍`;
    message = `A bloody stalemate — lost ${unitLoss}🧍`;
  } else {
    const unitLoss = Math.min(player.units, attackerUnits);
    const goldPct = 0.2 + Math.random() * 0.1; // 20–30%
    const goldLoss = Math.floor(player.gold * goldPct);

    player.units = Math.max(0, player.units - unitLoss);
    player.gold = Math.max(0, player.gold - goldLoss);

    board.gameMessage = `${player.name} is overwhelmed by the ambush, losing ${unitLoss}🧍 and ${goldLoss}🟡`;
    message = `Overwhelmed! Lost ${unitLoss}🧍 and ${goldLoss}🟡`;
  }

  const unitDiff = unitsBefore - player.units;
  const goldDiff = player.gold - goldBefore;
  const unitsPart = unitDiff > 0 ? `, lost ${unitDiff}🧍` : '';
  const goldPart =
    goldDiff > 0 ? `, gained ${goldDiff}🟡` : goldDiff < 0 ? `, lost ${-goldDiff}🟡` : '';
  const verb = outcome === 'win' ? 'repels an ambush' : outcome === 'defeat' ? 'is ambushed' : 'survives an ambush';
  say(
    `🏹 ${player.name} ${verb}${unitsPart}${goldPart}`,
    outcome === 'win' ? 'success' : outcome === 'defeat' ? 'error' : 'info'
  );

  return { outcome, message };
}
