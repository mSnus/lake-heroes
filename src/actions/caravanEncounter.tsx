import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { formatArmy } from '../utils/formatArmy';
import { isHeadlessRun } from '../utils/headlessStore';
import { shouldAttackCaravan } from '../ai/decisions';
import { t } from '../i18n';

export function checkCaravanEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  // Cheat: force a caravan, choosing its prize kind and skipping the usual
  // odds/eligibility gates.
  force?: 'gold' | 'slaves'
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

  const defendingUnits = Math.max(1, Math.floor((0.7 + Math.random() * 0.3) * player.units));
  const isSlaves = force ? force === 'slaves' : Math.random() < 0.4;
  
  const prize = isSlaves
    ? Math.max(1, Math.ceil(defendingUnits * (1.3 + Math.random() * 0.3)))
    : 100 * defendingUnits * (Math.floor(Math.random() * 2.3) + 1);

  const startBattle = () => {
    showBattleScreen(
      {
        mode: 'caravan',
        attacker: player,
        gameState: board,
        updateGameState,
        caravanDefence: defendingUnits,
        caravanPrize: prize,
        caravanSlaves: isSlaves,
        onClose: onContinue,
      },
      { screenType: 'caravan-battle', caravanDefence: defendingUnits, caravanPrize: prize }
    );
  };

  if (isHeadlessRun()) {
    if (shouldAttackCaravan(player, defendingUnits)) startBattle();
    else onContinue();
    return true;
  }

  const caravanDesc = isSlaves
    ? t('caravanEncounter.bringingChains', { prize })
    : t('caravanEncounter.ofGoodsWorth', { prize });

  showScreen({
    screenType: 'caravan',
    background: 'assets/screens/caravan.jpg',
    spriteImage: getPlayerImageSrc(player.image, player.isKnight),
    caravanDefence: defendingUnits,
    caravanPrize: prize,
    fade: true,
    htmlMessage: t('caravanEncounter.message', {
      playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
      gold: player.gold,
      army: formatArmy(player.militia, player.riders),
      defendingUnits,
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
