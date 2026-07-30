import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { DRAGON_UNITS } from '../../game/constants';
import { BattleResolution, BattleOutcome, logBattleSummary, lossStr } from './common';
import { t } from '../../i18n';

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
    board.gameMessage = t('resolveDragonBattle.slaysGameMessage', { attackerName: attacker.name });
    board.gameOver = true;
    message = t('resolveDragonBattle.slaysMessage');
    victoryBg = true;
  } else if (outcome === 'tie') {
    const unitLoss = Math.floor(DRAGON_UNITS / 4);
    attacker.units = Math.max(0, attacker.units - unitLoss);
    board.gameMessage = t('resolveDragonBattle.woundedGameMessage', { attackerName: attacker.name, units: unitLoss });
    message = t('resolveDragonBattle.woundedMessage', { units: unitLoss });
    lostBg = true;
  } else {
    const unitLoss = Math.ceil(attacker.units / 2);
    const goldLoss = Math.floor(attacker.gold / 2 / 100) * 100;
    attacker.units = Math.max(0, attacker.units - unitLoss);
    attacker.gold = Math.max(0, attacker.gold - goldLoss);
    const loss = lossStr(goldLoss, unitLoss);
    board.gameMessage = t('resolveDragonBattle.defeatedGameMessage', {
      attackerName: attacker.name,
      lossStr: loss ? t('resolveDragonBattle.lostSuffix', { loss }) : '',
    });
    message = loss ? t('resolveDragonBattle.lost', { loss }) : t('resolveDragonBattle.defeated');
    lostBg = true;
  }

  logBattleSummary(attacker, t('resolveDragonBattle.theDragon'), outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg, lostBg };
}
