import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { BattleResolution, BattleOutcome, logBattleSummary } from './common';

/**
 * Resolve a caravan raid.
 * - Win: attacker loses killed units, takes the full prize.
 * - Tie: no unit loss, takes 1/4 of the prize.
 * - Defeat: attacker loses killed units, no prize.
 * Slave caravans pay the prize in freed units instead of gold.
 */
export function resolveCaravanBattle(
  board: GameState,
  attacker: Player,
  opts: { prize: number; slaves: boolean },
  attackerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;
  const { prize, slaves } = opts;

  // Win/defeat: attacker loses units killed in battle; tie: no loss
  if (outcome !== 'tie' && attackerUnitsKilled > 0) {
    attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
  }

  const unitLossMsg = attackerUnitsKilled > 0 && outcome !== 'tie'
    ? `, ${attackerUnitsKilled}🧍 were lost in battle`
    : '';

  let message = '';
  let victoryBg = false;

  if (outcome === 'attacker') {
    if (slaves) {
      attacker.units += prize;
      board.gameMessage = `${attacker.name} freed ${prize}🧍 from the slavers!`;
      message = `${prize}🧍 freed from the slavers join your army!`;
    } else {
      attacker.gold += prize;
      board.gameMessage = `${attacker.name} raided the caravan and pillaged ${prize}🟡!`;
      message = `Pillaged ${prize}🟡`;
    }
    victoryBg = true;
  } else if (outcome === 'tie') {
    const quarterPrize = Math.floor(prize / 4);
    if (slaves) {
      attacker.units += quarterPrize;
      board.gameMessage = `${attacker.name} freed ${quarterPrize}🧍 from the caravan`;
      message = `Freed only ${quarterPrize}🧍`;
    } else {
      attacker.gold += quarterPrize;
      board.gameMessage = `${attacker.name} pillaged only ${quarterPrize}🟡.`;
      message = `Caravan guards held, you pillaged only ${quarterPrize}🟡.`;
    }
  } else {
    board.gameMessage = `${attacker.name} failed to raid the caravan`;
    message = `The caravan got away`;
  }

  board.gameMessage += unitLossMsg;
  message += unitLossMsg;

  logBattleSummary(attacker, 'Caravan Guards', outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg };
}
