import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { changeFame } from '../../utils/fame';
import { say } from '../../utils/say';
import { BattleResolution, BattleOutcome, tallyArmy, armyLostStr } from './common';
import { setGameMessage } from '../../utils/gameMessage';
import { t } from '../../i18n';
import { imprison } from '../prison';

/**
 * Resolve a Hero's Hour battle (player vs player).
 * battlefieldUnits = min(attacker.units, defender.units) — same for both sides.
 * - Win: attacker loses killed units; the loser goes to Prison (see
 *   prison.ts's imprison), losing the units actually killed in the fight.
 * - Tie: both lose half of battlefield units.
 * - Defeat: mirror of win, from the defender's perspective.
 */
export function resolvePlayerBattle(
  board: GameState,
  attacker: Player,
  defender: Player,
  battlefieldUnits: number,
  attackerUnitsKilled: number,
  defenderUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const aUnitsBefore = attacker.units;
  const aGoldBefore = attacker.gold;

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    const beforeLoss = tallyArmy(attacker);
    const beforeDefLoss = tallyArmy(defender);
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    if (defenderUnitsKilled > 0) defender.units = Math.max(0, defender.units - defenderUnitsKilled);
    imprison(board, defender);
    changeFame(attacker, 1);
    changeFame(defender, -1);

    const killed = armyLostStr(beforeLoss, attacker);
    const lossStr = killed ? t('resolvePlayerBattle.losingUnits', { army: killed }) : '';
    const defKilled = armyLostStr(beforeDefLoss, defender);
    const defLossStr = defKilled
      ? ' ' + t('resolvePlayerBattle.defenderLoses', { defenderName: defender.name, army: defKilled })
      : '';
    setGameMessage(
      board,
      t('resolvePlayerBattle.attackerWinsGameMessage', {
        attackerName: attacker.name,
        defenderName: defender.name,
        lossStr,
      }) + defLossStr
    );
    message = t('resolvePlayerBattle.attackerWinsMessage', { defenderName: defender.name, lossStr }) + defLossStr.replace(' ', '\n');
    victoryBg = true;
  } else if (outcome === 'tie') {
    const quarterLoss = Math.floor(battlefieldUnits / 4);
    if (quarterLoss > 0) {
      attacker.units = Math.max(0, attacker.units - quarterLoss);
      defender.units = Math.max(0, defender.units - quarterLoss);
    }

    setGameMessage(
      board,
      t('resolvePlayerBattle.tieGameMessage', {
        attackerName: attacker.name,
        defenderName: defender.name,
        loss: quarterLoss,
      })
    );
    message = t('resolvePlayerBattle.tieMessage', { loss: quarterLoss });
  } else {
    const beforeAtkLoss = tallyArmy(attacker);
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    imprison(board, attacker);
    const beforeDefLoss = tallyArmy(defender);
    if (defenderUnitsKilled > 0) defender.units = Math.max(0, defender.units - defenderUnitsKilled);
    changeFame(attacker, -1);
    changeFame(defender, 1);

    const defKilled = armyLostStr(beforeDefLoss, defender);
    const defLossStr = defKilled
      ? ' ' + t('resolvePlayerBattle.defenderLoses', { defenderName: defender.name, army: defKilled })
      : '';
    const atkKilled = armyLostStr(beforeAtkLoss, attacker);
    const atkLossStr = atkKilled
      ? ' ' + t('resolvePlayerBattle.defenderLoses', { defenderName: attacker.name, army: atkKilled })
      : '';
    setGameMessage(
      board,
      t('resolvePlayerBattle.defenderWinsGameMessage', {
        attackerName: attacker.name,
        defenderName: defender.name,
      }) + atkLossStr + defLossStr
    );
    message = t('resolvePlayerBattle.defenderWinsMessage', { defLossStr }) + atkLossStr.replace(' ', '\n');
    lostBg = true;
  }

  const goldPart = attacker.gold !== aGoldBefore ? `, ${aGoldBefore}→${attacker.gold}🟡` : '';
  const outcomeLabel = t(
    outcome === 'attacker'
      ? 'resolvePlayerBattle.attackerWinsLabel'
      : outcome === 'defender'
        ? 'resolvePlayerBattle.defenderWinsLabel'
        : 'resolvePlayerBattle.tieLabel'
  );
  say(
    t('resolvePlayerBattle.logLine', {
      attackerName: attacker.name,
      defenderName: defender.name,
      outcomeLabel,
      unitsBefore: aUnitsBefore,
      unitsAfter: attacker.units,
      goldPart,
    }),
    outcome === 'attacker' ? 'success' : outcome === 'defender' ? 'error' : 'info'
  );

  return { outcome, message, victoryBg, lostBg };
}
