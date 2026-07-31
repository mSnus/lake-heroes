import React from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { showScreen, clearScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';
import { changeFame } from '../utils/fame';
import { t } from '../i18n';

const ENCOUNTER_CHANCE = 1 / 14;

/**
 * Rogue Attack: a roaming horde raids one of the player's own tiles.
 * Same trigger odds/preconditions as an ambush, plus needing at least one
 * owned tile to actually target. Goes through the normal BattleScreen duel
 * (brawl or automatic, same rule as any other fight) with a synthetic NPC
 * "horde" Player standing in for the attacker role, so it always auto-rolls
 * regardless of brawl/non-brawl — there's no real entity to click for it.
 * The tile owner's garrison defends as usual (manual click in brawl mode,
 * same as any other tile battle).
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

  const garrison = tile.garrison;

  // Nothing to defend with — a real BattleScreen duel needs at least one
  // unit on the defending side, so this is an automatic raze, no battle.
  if (garrison <= 0) {
    const tileName = tile.name;
    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((i) => i !== tileIdx);
    });
    tile.owner = null;
    tile._level = 1;
    tile.garrison = tile.baseGarrison;
    tile.unclaimedSinceTurn = board.turns;
    tile.razedInRound = board.round;
    changeFame(player, -1);
    updateGameState(board);

    showScreen({
      screenType: 'rogue-attack-razed',
      background: 'assets/screens/caravan.jpg',
      title: t('rogueAttack.title'),
      spriteImage: 'assets/figures/npc-saracen.png',
      fade: true,
      message: t('rogueAttack.razed', { tileName }),
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

  const attackFactor = 0.3 + Math.random() * 0.9;
  const hordeUnits = Math.max(1, Math.round(garrison * attackFactor));

  const horde = new Player({
    name: t('rogueAttack.horde'),
    color: '#8b5a2b',
    gold: 0,
    units: hordeUnits,
    position: -1,
    image: 'black',
    isComputer: true,
  });

  showScreen({
    screenType: 'rogue-attack',
    content: React.createElement(BattleScreen, {
      mode: 'rogue',
      attacker: horde,
      defender: player,
      tile,
      gameState: board,
      updateGameState,
      onClose: onContinue,
    }),
  });

  return true;
}
