import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { t } from '../i18n';

const ENCOUNTER_CHANCE = 1 / 14;

/**
 * Rogue Attack: a roaming horde raids one of the player's own tiles.
 * Same trigger odds/preconditions as an ambush, plus needing at least one
 * owned tile to actually target. Fully automatic (the garrison "defends"
 * itself) -- no player interaction beyond dismissing the result.
 * - Empty garrison: automatic raze, nothing to fight with.
 * - Win (attack < garrison): garrison grows 25%, capped by capacity.
 * - Loss (attack > garrison): tile is razed, same as losing a real battle.
 * - Tie (attack === garrison, after rounding): garrison takes real losses
 *   equal to the (repelled) attack, but the tile itself isn't lost.
 */
export function checkRogueAttackEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;

  // No rogue attacks during the first lap around the board.
  if ((player.circles ?? 0) < 1) return false;

  if (player.fame < 3) return false;
  if (player.armyPower < 5) return false;
  if (player.ownedTiles.length < 1) return false;
  if (Math.random() >= ENCOUNTER_CHANCE) return false;

  const tileIdx = player.ownedTiles[Math.floor(Math.random() * player.ownedTiles.length)];
  const tile = board.tiles[tileIdx];
  if (!tile) return false;

  const tileName = tile.name;
  const garrisonBefore = tile.garrison;

  let message: string;

  const razeTile = () => {
    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((i) => i !== tileIdx);
    });
    tile.owner = null;
    tile._level = 1;
    tile.garrison = tile.baseGarrison;
    tile.unclaimedSinceTurn = board.turns;
    tile.razedInRound = board.round;
    changeFame(player, -1);
  };

  if (garrisonBefore <= 0) {
    razeTile();
    message = t('rogueAttack.razed', { tileName });
    say(t('rogueAttack.razedToast', { playerName: player.name, tileName }), 'error');
  } else {
    const attackFactor = 0.3 + Math.random() * 0.9;
    const attackPower = Math.round(garrisonBefore * attackFactor);

    if (attackPower > garrisonBefore) {
      razeTile();
      message = t('rogueAttack.razed', { tileName });
      say(t('rogueAttack.razedToast', { playerName: player.name, tileName }), 'error');
    } else if (attackPower < garrisonBefore) {
      tile.garrison = garrisonBefore + Math.round(garrisonBefore * 0.25);
      const gained = tile.garrison - garrisonBefore;
      if (gained > 0) {
        message = t('rogueAttack.wonGrows', { tileName, units: gained });
      } else {
        message = t('rogueAttack.wonFull', { tileName });
      }
      say(t('rogueAttack.wonToast', { playerName: player.name, tileName }), 'success');
    } else {
      tile.garrison = Math.max(0, garrisonBefore - attackPower);
      message = t('rogueAttack.tie', { tileName, units: attackPower });
      say(t('rogueAttack.tieToast', { playerName: player.name, tileName, units: attackPower }), 'warning');
    }
  }

  updateGameState(board);

  showScreen({
    screenType: 'rogue-attack',
    background: 'assets/screens/caravan.jpg',
    title: t('rogueAttack.title'),
    spriteImage: 'assets/figures/npc-saracen.png',
    fade: true,
    message,
    buttons: [
      {
        label: t('common.continue'),
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
    ],
  });

  return true;
}
