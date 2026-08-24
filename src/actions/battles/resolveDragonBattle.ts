import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { DRAGON_UNITS } from '../../game/constants';
import { BattleResolution, BattleOutcome, logBattleSummary, lossStr } from './common';
import { recordStatEvent } from '../../game/statistics';
import { setGameMessage } from '../../utils/gameMessage';
import { t } from '../../i18n';

/**
 * Resolve the dragon challenge.
 * - Win: game is won.
 * - Tie: attacker loses 1/4 of their units.
 * - Defeat: attacker loses their entire army, but keeps their gold.
 */
export function resolveDragonBattle(
  board: GameState,
  attacker: Player,
  _attackerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;

  recordStatEvent(board, attacker, 'dragon');

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    setGameMessage(board, t('resolveDragonBattle.slaysGameMessage', { attackerName: attacker.name }));
    board.gameOver = true;
    message = t('resolveDragonBattle.slaysMessage');
    victoryBg = true;
  } else if (outcome === 'tie') {
    const unitLoss = Math.floor(DRAGON_UNITS / 4);
    attacker.units = Math.max(0, attacker.units - unitLoss);
    setGameMessage(board, t('resolveDragonBattle.woundedGameMessage', { attackerName: attacker.name, units: unitLoss }));
    message = t('resolveDragonBattle.woundedMessage', { units: unitLoss });
    lostBg = true;
  } else {
    const unitLoss = attacker.units;
    attacker.units = 0;
    const loss = lossStr(0, unitLoss);
    setGameMessage(
      board,
      t('resolveDragonBattle.defeatedGameMessage', {
        attackerName: attacker.name,
        lossStr: loss ? t('resolveDragonBattle.lostSuffix', { loss }) : '',
      })
    );
    message = loss ? t('resolveDragonBattle.lost', { loss }) : t('resolveDragonBattle.defeated');
    lostBg = true;
  }

  logBattleSummary(attacker, t('resolveDragonBattle.theDragon'), outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg, lostBg };
}
