import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { changeFame } from '../../utils/fame';
import { say } from '../../utils/say';
import { BattleResolution, BattleOutcome } from './common';
import { setGameMessage } from '../../utils/gameMessage';
import { t } from '../../i18n';

/**
 * Resolve a Hero's Hour battle (player vs player).
 * battlefieldUnits = min(attacker.units, defender.units) — same for both sides.
 * - Win: attacker loses killed units; loser flees to King's Castle (tile 0),
 *   losing the units actually killed in the duel-by-duel fight.
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
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    if (defenderUnitsKilled > 0) defender.units = Math.max(0, defender.units - defenderUnitsKilled);
    defender.position = 0;
    changeFame(attacker, 1);
    changeFame(defender, -1);

    const lossStr = attackerUnitsKilled > 0 ? t('resolvePlayerBattle.losingUnits', { units: attackerUnitsKilled }) : '';
    setGameMessage(
      board,
      t('resolvePlayerBattle.attackerWinsGameMessage', {
        attackerName: attacker.name,
        defenderName: defender.name,
        lossStr,
      })
    );
    message = t('resolvePlayerBattle.attackerWinsMessage', { defenderName: defender.name, lossStr });
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
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    attacker.position = 0;
    if (defenderUnitsKilled > 0) defender.units = Math.max(0, defender.units - defenderUnitsKilled);
    changeFame(attacker, -1);
    changeFame(defender, 1);

    const defLossStr =
      defenderUnitsKilled > 0
        ? ' ' + t('resolvePlayerBattle.defenderLoses', { defenderName: defender.name, units: defenderUnitsKilled })
        : '';
    setGameMessage(
      board,
      t('resolvePlayerBattle.defenderWinsGameMessage', {
        attackerName: attacker.name,
        defenderName: defender.name,
      })
    );
    message = t('resolvePlayerBattle.defenderWinsMessage', { defLossStr });
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
