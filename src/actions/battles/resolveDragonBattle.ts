import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { DRAGON_UNITS } from '../../game/constants';
import { BattleResolution, BattleOutcome, logBattleSummary, lossStr } from './common';

/**
 * Resolve the dragon challenge.
 * - Win: game is won.
 * - Tie: attacker loses 1/4 of their units.
 * - Defeat: attacker loses 1/2 units and 1/2 gold.
 */
export function resolveDragonBattle(
  board: GameState,
  attacker: Player,
  _attackerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
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
    const unitLoss = Math.floor(DRAGON_UNITS / 4);
    attacker.units = Math.max(0, attacker.units - unitLoss);
    board.gameMessage = `${attacker.name} wounded the Dragon, but he escaped, taking ${unitLoss}🧍`;
    message = `The wounded Dragon retreats, taking ${unitLoss}🧍 with him`;
    lostBg = true;
  } else {
    const unitLoss = Math.ceil(attacker.units / 2);
    const goldLoss = Math.floor(attacker.gold / 2 / 100) * 100;
    attacker.units = Math.max(0, attacker.units - unitLoss);
    attacker.gold = Math.max(0, attacker.gold - goldLoss);
    const loss = lossStr(goldLoss, unitLoss);
    board.gameMessage = `${attacker.name} was defeated by the Dragon!${loss ? ` Lost ${loss}` : ''}`;
    message = `${loss ? `Lost ${loss}` : 'Defeated'}`;
    lostBg = true;
  }

  logBattleSummary(attacker, 'The Dragon', outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg, lostBg };
}
