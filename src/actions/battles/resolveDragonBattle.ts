import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import {
  BattleResolution,
  RoundResult,
  determineBattleOutcome,
  logBattleSummary,
  perRoundUnitLoss,
} from './common';

/**
 * Resolve the dragon challenge (the player attacks).
 * - Win: the game is won.
 * - Tie: the dragon escapes; attacker loses per-round units.
 * - Defeat: attacker loses half their units and all their gold.
 */
export function resolveDragonBattle(
  board: GameState,
  attacker: Player,
  defence: number,
  totalRounds: number,
  results: RoundResult[]
): BattleResolution {
  const outcome = determineBattleOutcome(results);
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    board.gameMessage = `${attacker.name} slays the Dragon! 🐉 VICTORY!`;
    board.gameOver = true;
    message = 'The Dragon is slain! 🐉 VICTORY!';
    victoryBg = true;
  } else if (outcome === 'tie') {
    const unitLoss = perRoundUnitLoss(defence, totalRounds, results);
    if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);

    const lossStr = unitLoss > 0 ? `. ${unitLoss}🧍 were eaten by the Dragon` : '';
    board.gameMessage = `${attacker.name} wounded the Dragon, but he escaped. ${lossStr}`;
    message = `The Dragon retreats, wounded${lossStr}`;
    lostBg = true;
  } else {
    const unitLoss = Math.ceil(attacker.units / 2);
    const goldLoss = attacker.gold;
    attacker.units = Math.max(0, attacker.units - unitLoss);
    attacker.gold = 0;
    board.gameMessage = `${attacker.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍`;
    message = `Lost all gold and ${unitLoss}🧍`;
    lostBg = true;
  }

  logBattleSummary(attacker, 'The Dragon', outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg, lostBg };
}
