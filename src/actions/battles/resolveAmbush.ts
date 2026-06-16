import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { say } from '../../utils/say';

export type AmbushOutcome = 'win' | 'defeat' | 'tie';

export interface AmbushResolution {
  outcome: AmbushOutcome;
  message: string;
}

const GOLD_PER_KILL = 200;

/**
 * Apply the outcome of an ambush (the game attacks the player).
 * - Win (ambush fails): player loses killed units; earns 200🟡 per ambusher killed.
 * - Tie: no unit loss; player loses 1/4 gold.
 * - Defeat: player loses killed units; loses 1/4 gold.
 */
export function resolveAmbush(
  board: GameState,
  player: Player,
  _attackerUnits: number,
  playerUnitsKilled: number,
  ambusherUnitsKilled: number,
  outcome: AmbushOutcome
): AmbushResolution {
  const goldBefore = player.gold;
  const unitsBefore = player.units;

  let message = '';

  if (outcome === 'win') {
    const reward = ambusherUnitsKilled * GOLD_PER_KILL;
    if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);
    player.gold += reward;

    const lossStr = playerUnitsKilled > 0 ? `, losing ${playerUnitsKilled}🧍` : '';
    board.gameMessage = `${player.name} repels the ambush, receiving ${reward}🟡${lossStr}`;
    message = `Ambush repelled! Your reward is ${reward}🟡${lossStr}`;
  } else if (outcome === 'tie') {
    const goldLoss = Math.floor(player.gold / 4);
    player.gold = Math.max(0, player.gold - goldLoss);
    board.gameMessage = `${player.name} barely survives the ambush, losing ${goldLoss}🟡`;
    message = `A bloody stalemate — lost ${goldLoss}🟡`;
  } else {
    const goldLoss = Math.floor(player.gold / 4);
    if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);
    player.gold = Math.max(0, player.gold - goldLoss);
    const lossStr = playerUnitsKilled > 0 ? ` and ${playerUnitsKilled}🧍` : '';
    board.gameMessage = `${player.name} is overwhelmed by the ambush, losing ${goldLoss}🟡${lossStr}`;
    message = `Lost ${goldLoss}🟡${lossStr}`;
  }

  const unitDiff = unitsBefore - player.units;
  const goldDiff = player.gold - goldBefore;
  const unitsPart = unitDiff > 0 ? `, lost ${unitDiff}🧍` : '';
  const goldPart =
    goldDiff > 0 ? `, gained ${goldDiff}🟡` : goldDiff < 0 ? `, lost ${-goldDiff}🟡` : '';
  const verb =
    outcome === 'win'
      ? 'repels an ambush'
      : outcome === 'defeat'
        ? 'is ambushed'
        : 'survives an ambush';
  say(
    `${player.name} ${verb}${unitsPart}${goldPart}`,
    outcome === 'win' ? 'success' : outcome === 'defeat' ? 'error' : 'info'
  );

  return { outcome, message };
}
