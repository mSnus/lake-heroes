import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { BattleResolution, BattleOutcome, logBattleSummary } from './common';
import { CaravanPrize, quarterPrize, mountHorses, rollGuardsJoining } from '../../game/caravanPrize';
import { setGameMessage } from '../../utils/gameMessage';
import { say } from '../../utils/say';
import { t } from '../../i18n';

/**
 * Resolve a caravan raid.
 * - Win: attacker loses killed units, takes the full cargo.
 * - Tie: no unit loss from the raid itself, takes a quarter of every part.
 * - Defeat: attacker loses killed units, takes nothing.
 *
 * The cargo is a mix (see game/caravanPrize.ts): gold, freed slaves who
 * join as militia, and horses that promote militia to riders. Some of the
 * beaten escort may throw in with the victor on top of that.
 */
export function resolveCaravanBattle(
  board: GameState,
  attacker: Player,
  opts: { prize: CaravanPrize; defence: number; guardMilitia: number; guardRiders: number },
  attackerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;
  const { prize, defence, guardMilitia, guardRiders } = opts;

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
  let gameMessage = '';
  let victoryBg = false;

  /** Hand over a (possibly quartered) cargo and describe what arrived.
   * Slaves are clamped by the army's own slot room, and horses only mount
   * as many militia as the army can re-tier -- so the haul reported is
   * always what was actually received, never what was offered. */
  const collect = (won: CaravanPrize): string[] => {
    const parts: string[] = [];
    if (won.gold > 0) {
      attacker.gold += won.gold;
      parts.push(t('resolveCaravanBattle.haulGold', { gold: won.gold }));
    }

    const freed = attacker.gainMilitia(won.slaves);
    if (freed > 0) parts.push(t('resolveCaravanBattle.haulSlaves', { units: freed }));

    const mounted = mountHorses(attacker, won.horses);
    if (mounted > 0) parts.push(t('resolveCaravanBattle.haulHorses', { units: mounted }));

    return parts;
  };

  if (outcome === 'attacker') {
    const parts = collect(prize);

    // Only a decisive win impresses the survivors.
    const joining = rollGuardsJoining(guardMilitia, guardRiders);
    const joinedMilitia = attacker.gainMilitia(joining.militia);
    const joinedRiders = attacker.isKnight ? attacker.gainRiders(joining.riders) : 0;
    if (joinedMilitia + joinedRiders > 0) {
      const joinedStr = t('resolveCaravanBattle.haulRecruits', {
        units: joinedMilitia + joinedRiders,
      });
      parts.push(joinedStr);
      say(t('resolveCaravanBattle.guardsJoined', { playerName: attacker.name, units: joinedMilitia + joinedRiders }), 'success');
    }

    const haul = parts.join(t('resolveCaravanBattle.haulJoin'));
    gameMessage = t('resolveCaravanBattle.raidedGameMessage', { attackerName: attacker.name, haul });
    message = t('resolveCaravanBattle.raidedMessage', { haul });
    victoryBg = true;
  } else if (outcome === 'tie') {
    const unitLoss = Math.floor(defence / 4);
    if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
    const tieLossStr = unitLoss > 0 ? t('resolveCaravanBattle.losingSuffix', { units: unitLoss }) : '';

    const parts = collect(quarterPrize(prize));
    const haul = parts.length > 0 ? parts.join(t('resolveCaravanBattle.haulJoin')) : t('resolveCaravanBattle.haulNothing');
    gameMessage = t('resolveCaravanBattle.raidedOnlyGameMessage', { attackerName: attacker.name, haul, lossStr: tieLossStr });
    message = t('resolveCaravanBattle.raidedOnlyMessage', { haul, lossStr: tieLossStr });
  } else {
    gameMessage = t('resolveCaravanBattle.failedGameMessage', { attackerName: attacker.name });
    message = t('resolveCaravanBattle.gotAway');
  }

  setGameMessage(board, gameMessage + unitLossMsgGame);
  message += unitLossMsgScreen;

  logBattleSummary(attacker, t('resolveCaravanBattle.caravanGuards'), outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg };
}
