import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { lossStr } from './common';

export type AmbushOutcome = 'win' | 'defeat' | 'tie';

export interface AmbushResolution {
  outcome: AmbushOutcome;
  message: string;
}

const GOLD_PER_KILL = 200;

/**
 * Apply the outcome of an ambush (the game attacks the player).
 * - Win (ambush fails): player loses killed units; earns 200🟡 per ambusher killed.
 * - Tie: player loses 1/4 of involved units and 1/2 gold.
 * - Defeat: player loses killed units; loses 1/4 gold.
 */
export function resolveAmbush(
  board: GameState,
  player: Player,
  attackerUnits: number,
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
    const unitLoss = Math.floor(attackerUnits / 4);
    const goldLoss = Math.floor(player.gold / 2 / 100) * 100;
    if (unitLoss > 0) player.units = Math.max(0, player.units - unitLoss);
    player.gold = Math.max(0, player.gold - goldLoss);
    const loss = lossStr(goldLoss, unitLoss);
    board.gameMessage = `${player.name} barely survives the ambush${loss ? `, losing ${loss}` : ''}`;
    message = `A bloody stalemate${loss ? ` — lost ${loss}` : ''}`;
  } else {
    const goldLoss = Math.floor(player.gold / 4 / 100) * 100;
    if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);
    player.gold = Math.max(0, player.gold - goldLoss);
    const loss = lossStr(goldLoss, playerUnitsKilled);
    board.gameMessage = `${player.name} is overwhelmed by the ambush${loss ? `, losing ${loss}` : ''}`;
    message = `${loss ? `Lost ${loss}` : 'Overwhelmed'}`;
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
