import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { BattleResolution, BattleOutcome, logBattleSummary } from './common';
import { t } from '../../i18n';

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
  const unitLossMsgGame = lostUnits ? t('resolveCaravanBattle.whileUnitsLostGame', { units: attackerUnitsKilled }) : '';
  const unitLossMsgScreen = lostUnits ? t('resolveCaravanBattle.whileUnitsLostScreen', { units: attackerUnitsKilled }) : '';

  let message = '';
  let victoryBg = false;

  if (outcome === 'attacker') {
    if (slaves) {
      attacker.units += prize;
      board.gameMessage = t('resolveCaravanBattle.freedGameMessage', { attackerName: attacker.name, prize });
      message = t('resolveCaravanBattle.freedMessage', { prize });
    } else {
      attacker.gold += prize;
      board.gameMessage = t('resolveCaravanBattle.pillagedGameMessage', { attackerName: attacker.name, prize });
      message = t('resolveCaravanBattle.pillagedMessage', { prize });
    }
    victoryBg = true;
  } else if (outcome === 'tie') {
    const quarterPrize = Math.floor(prize / 4);
    const unitLoss = Math.floor(defence / 4);
    if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
    const tieLossStr = unitLoss > 0 ? t('resolveCaravanBattle.losingSuffix', { units: unitLoss }) : '';

    if (slaves) {
      attacker.units += quarterPrize;
      board.gameMessage = t('resolveCaravanBattle.freedOnlyGameMessage', { attackerName: attacker.name, prize: quarterPrize, lossStr: tieLossStr });
      message = t('resolveCaravanBattle.freedOnlyMessage', { prize: quarterPrize, lossStr: tieLossStr });
    } else {
      attacker.gold += quarterPrize;
      board.gameMessage = t('resolveCaravanBattle.pillagedOnlyGameMessage', { attackerName: attacker.name, prize: quarterPrize, lossStr: tieLossStr });
      message = t('resolveCaravanBattle.pillagedOnlyMessage', { prize: quarterPrize, lossStr: tieLossStr });
    }
  } else {
    board.gameMessage = t('resolveCaravanBattle.failedGameMessage', { attackerName: attacker.name });
    message = t('resolveCaravanBattle.gotAway');
  }

  board.gameMessage += unitLossMsgGame;
  message += unitLossMsgScreen;

  logBattleSummary(attacker, t('resolveCaravanBattle.caravanGuards'), outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg };
}
