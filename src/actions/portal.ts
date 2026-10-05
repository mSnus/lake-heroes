import React from 'react';
import { GameState } from '../game/GameState';
import { TILE_COUNT, KARMA_PRISON_CHANCE } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
import { isHeadlessRun } from '../utils/headlessStore';
import { revealTile } from './revealTile';
import { passStart } from './passStart';
import { PortalScreen } from '../components/PortalScreen';

export function handlePortal(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
) {
  const player = board.activePlayer;
  const portalPos = player.position;

  // Teleport to any random tile except the portal itself -- a cursed player
  // has a small clandestine chance of landing squarely on Prison instead.
  const prisonIdx = board.tiles.findIndex((t) => t?.id === 'prison');
  let newPos: number;
  if (player.karma < 0 && prisonIdx >= 0 && prisonIdx !== portalPos && Math.random() < KARMA_PRISON_CHANCE) {
    newPos = prisonIdx;
  } else {
    do {
      newPos = Math.floor(Math.random() * TILE_COUNT);
    } while (newPos === portalPos);
  }

  player.position = newPos;

  const landedTile = board.tiles[newPos];
  const wasFogged = landedTile.fog;
  landedTile.fog = false;

  if (wasFogged) {
    revealTile(board);
  }

  // A normal dice-driven landing on King's Castle always wraps through
  // position 0 in rollAndMove.ts's step loop, which is the only place
  // player.circles normally increments (passStart). Teleporting straight
  // onto it skips that loop entirely -- without this, a player whose first
  // King's Castle visit ever happens to be via Portal would have circles
  // stuck at 0, silently gating every first-lap check (caravan/ambush/
  // rogue encounters, the dragon, Tavern's circleMultiplier) until they
  // eventually wrap around for real.
  if (landedTile.id === 'king-castle') {
    passStart(board, updateGameState);
  }

  updateGameState(board);
  // Same rule as a normal landing (rollAndMove.ts): only auto-show the tile
  // card for an ownable tile -- special tiles get PortalScreen right below
  // instead, so the plain card would just be a redundant flash underneath it.
  gameEvent('displayTile', landedTile.isOwnable ? landedTile : {});

  // Nothing to decide -- PortalScreen is just a timed reveal for a human to
  // read, then calls onContinue itself for a bot too.
  if (isHeadlessRun()) {
    onContinue();
    return;
  }

  showScreen({
    screenType: 'portal',
    content: React.createElement(PortalScreen, {
      player,
      landedTile,
      onContinue: () => {
        clearScreen();
        onContinue();
      },
    }),
  });
}
