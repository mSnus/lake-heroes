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
  opts: { prize: number; slaves: boolean; defence: number },
  attackerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;
  const { prize, slaves, defence } = opts;

  // Win/defeat: attacker loses units killed in battle
  if (outcome !== 'tie' && attackerUnitsKilled > 0) {
    attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
  }

  const lostUnits = attackerUnitsKilled > 0 && outcome !== 'tie';
  // The screen message keeps the full "fighting for it" phrasing; the game
  // log (board.gameMessage) drops it for a terser one-line log entry.
  const unitLossMsgGame = lostUnits ? ` while ${attackerUnitsKilled}🧍 were lost` : '';
  const unitLossMsgScreen = lostUnits ? ` while ${attackerUnitsKilled}🧍 were lost fighting for it` : '';

  let message = '';
  let victoryBg = false;

  if (outcome === 'attacker') {
    if (slaves) {
      attacker.units += prize;
      board.gameMessage = `${attacker.name} freed ${prize}🧍!`;
      message = `${prize}🧍 were freed and join your army!`;
    } else {
      attacker.gold += prize;
      board.gameMessage = `${attacker.name} raided the caravan and pillaged ${prize}🟡!`;
      message = `Pillaged ${prize}🟡`;
    }
    victoryBg = true;
  } else if (outcome === 'tie') {
    const quarterPrize = Math.floor(prize / 4);
    const unitLoss = Math.floor(defence / 4);
    if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
    const tieLossStr = unitLoss > 0 ? `, losing ${unitLoss}🧍` : '';

    if (slaves) {
      attacker.units += quarterPrize;
      board.gameMessage = `${attacker.name} freed only ${quarterPrize}🧍 from the caravan${tieLossStr}`;
      message = `Freed only ${quarterPrize}🧍${tieLossStr}!`;
    } else {
      attacker.gold += quarterPrize;
      board.gameMessage = `${attacker.name} pillaged only ${quarterPrize}🟡${tieLossStr}`;
      message = `Caravan guards held, pillaged only ${quarterPrize}🟡${tieLossStr}`;
    }
  } else {
    board.gameMessage = `${attacker.name} failed to raid the caravan!`;
    message = `The caravan got away!`;
  }

  board.gameMessage += unitLossMsgGame;
  message += unitLossMsgScreen;

  logBattleSummary(attacker, 'Caravan Guards', outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg };
}
