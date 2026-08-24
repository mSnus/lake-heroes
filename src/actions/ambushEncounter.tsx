import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { isHeadlessRun } from '../utils/headlessStore';
import { formatArmy, AMBUSH_EMOJI } from '../utils/formatArmy';
import { KNIGHT_FAME } from '../game/constants';
import { t } from '../i18n';

export function checkAmbushEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;
  const ENCOUNTER_CHANCE = 1 / 14;

  // No ambushes during the first lap around the board
  if ((player.circles ?? 0) < 1) return false;

  if (player.fame <= KNIGHT_FAME) return false;
  if (player.armyPower <= 15) return false;

  // Max 1 per year
  if ((player.ambushEncounters ?? 0) >= 1) return false;
  if (Math.random() >= ENCOUNTER_CHANCE) return false;

  player.ambushEncounters = (player.ambushEncounters ?? 0) + 1;
  updateGameState(board);

  // The ambushers field 50–70% of the player's units, tier by tier -- the
  // same roll the total used to get, so a mounted player is waylaid by
  // mounted bandits.
  const scale = () => 0.5 + Math.random() * 0.2;
  const attackerRiders = Math.round(scale() * player.riders);
  const attackerMilitia = Math.max(attackerRiders > 0 ? 0 : 1, Math.round(scale() * player.militia));
  const attackerUnits = attackerMilitia + attackerRiders;

  const startBattle = () => {
    showBattleScreen(
      {
        mode: 'ambush',
        attacker: player,
        ambushAttackerUnits: attackerUnits,
        ambushAttackerRiders: attackerRiders,
        gameState: board,
        updateGameState,
        onClose: onContinue,
      },
      {
        screenType: 'ambush-battle',
        ambushAttackerUnits: attackerUnits,
        ambushAttackerRiders: attackerRiders,
      }
    );
  };

  // No decision here -- an ambush always has to be fought, so there's
  // nothing for a headless run to skip straight to but the battle itself.
  if (isHeadlessRun()) {
    startBattle();
    return true;
  }

  showScreen({
    screenType: 'ambush',
    background: 'assets/screens/ambush.jpg',
    title: t('ambushEncounter.title'),
    fade: true,
    spriteImage: 'assets/figures/npc-saracen.png',
    htmlMessage: t('ambushEncounter.message', {
      playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
      squad: formatArmy(attackerMilitia, attackerRiders, AMBUSH_EMOJI),
    }),
    buttons: [{ label: t('ambushEncounter.defend'), onClick: startBattle }],
  });

  return true;
}
