import { GameState } from '../game/GameState';
import { showScreenWithFog, clearScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { formatArmy, CARAVAN_EMOJI } from '../utils/formatArmy';
import { isHeadlessRun } from '../utils/headlessStore';
import { shouldAttackCaravan } from '../ai/decisions';
import { rollCaravanPrize, CaravanPrize } from '../game/caravanPrize';
import { announce } from '../utils/announce';
import { t } from '../i18n';

/** Share of the escort its cargo is worth that actually stands and fights.
 * 0.765 is 15% below the 0.9 this started at -- the prize is unaffected,
 * since it is priced off the full escort, so this makes a caravan a softer
 * target for the same payout. */
const CARAVAN_GUARD_RATIO = 0.765;

export function checkCaravanEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  // Cheat: force a caravan, guaranteeing one prize kind is present and
  // skipping the usual odds/eligibility gates.
  force?: 'gold' | 'slaves' | 'horses'
): boolean {
  const player = board.activePlayer;
  const ENCOUNTER_CHANCE = 1 / 12;

  if (!force) {
    // No caravans during the first lap around the board
    if ((player.circles ?? 0) < 1) return false;

    // Not enough units to threaten a caravan
    if (player.units < 3) return false;

    // No back-to-back
    if (player.caravanEncounteredLastTurn) {
      player.caravanEncounteredLastTurn = false;
      return false;
    }

    // Max 2 per year
    if ((player.caravanEncounters ?? 0) >= 2) return false;
    // 1/12 chance
    if (Math.random() >= ENCOUNTER_CHANCE) return false;
  }

  // Encounter!
  player.caravanEncounters = (player.caravanEncounters ?? 0) + 1;
  player.caravanEncounteredLastTurn = true;
  updateGameState(board);

  // The escort mirrors the player's own army tier by tier -- the same
  // 70-100% roll the total used to get, drawn once per tier so a mounted
  // player meets mounted guards. The cargo is priced off that full escort,
  // but only CARAVAN_GUARD_RATIO of it actually turns out to fight.
  const scale = () => 0.7 + Math.random() * 0.3;
  const rawRiders = scale() * player.riders;
  const rawMilitia = scale() * player.militia;

  const escortRiders = Math.floor(rawRiders);
  const escortMilitia = Math.max(escortRiders > 0 ? 0 : 1, Math.floor(rawMilitia));
  const prizeUnits = escortMilitia + escortRiders;

  // Rounded off the raw figure, not off the escort -- flooring twice would
  // compound into a bigger cut than CARAVAN_GUARD_RATIO asks for.
  const defendingRiders = Math.floor(rawRiders * CARAVAN_GUARD_RATIO);
  const defendingMilitia = Math.max(
    defendingRiders > 0 ? 0 : 1,
    Math.floor(rawMilitia * CARAVAN_GUARD_RATIO)
  );
  const defendingUnits = defendingMilitia + defendingRiders;
  // A caravan's cargo is a mix -- gold, slaves and (for a Knight) horses,
  // each rolled on its own odds. The cheat guarantees its named kind is
  // present without suppressing the others.
  const prize: CaravanPrize = rollCaravanPrize(prizeUnits, player.isKnight);
  if (force) {
    const forced = rollCaravanPrize(prizeUnits, true);
    if (force === 'gold' && prize.gold <= 0) prize.gold = forced.gold || 100 * prizeUnits;
    if (force === 'slaves' && prize.slaves <= 0) prize.slaves = forced.slaves || 1;
    if (force === 'horses' && prize.horses <= 0) prize.horses = forced.horses || 1;
  }

  const startBattle = () => {
    showBattleScreen(
      {
        mode: 'caravan',
        attacker: player,
        gameState: board,
        updateGameState,
        caravanDefence: defendingUnits,
        caravanDefenceRiders: defendingRiders,
        caravanPrize: prize,
        onClose: onContinue,
      },
      {
        screenType: 'caravan-battle',
        caravanDefence: defendingUnits,
        caravanDefenceRiders: defendingRiders,
        caravanPrize: prize,
      }
    );
  };

  if (isHeadlessRun()) {
    if (shouldAttackCaravan(player, defendingUnits)) {
      announce(player, 'botController.attackTheCaravan');
      startBattle();
    } else onContinue();
    return true;
  }

  const caravanDesc = describeCaravanCargo(prize);

  showScreenWithFog({
    screenType: 'caravan',
    background: 'assets/screens/caravan.jpg',
    spriteImage: getPlayerImageSrc(player.image, player.isKnight),
    caravanDefence: defendingUnits,
    caravanDefenceRiders: defendingRiders,
    caravanPrize: prize,
    fade: true,
    htmlMessage: t('caravanEncounter.message', {
      playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
      gold: player.gold,
      army: formatArmy(player.militia, player.riders),
      guards: formatArmy(defendingMilitia, defendingRiders, CARAVAN_EMOJI),
      caravanDesc,
    }),
    buttons: [
      {
        label: t('caravanEncounter.letThemPass'),
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
      { label: t('caravanEncounter.attack'), onClick: startBattle },
    ],
  });

  return true;
}

/** The cargo line on the encounter screen -- zero components are left out
 * entirely, so a gold-only caravan reads exactly as it always did. */
export function describeCaravanCargo(prize: CaravanPrize): string {
  const parts: string[] = [];
  if (prize.gold > 0) parts.push(t('caravanEncounter.ofGoodsWorth', { prize: prize.gold }));
  if (prize.slaves > 0) parts.push(t('caravanEncounter.bringingChains', { prize: prize.slaves }));
  if (prize.horses > 0) parts.push(t('caravanEncounter.drivingHorses', { prize: prize.horses }));
  return parts.join(t('caravanEncounter.cargoJoin'));
}
