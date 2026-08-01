import React from 'react';
import { GameState } from '../game/GameState';
import { TILE_COUNT } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
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

  // Teleport to any random tile except the portal itself
  let newPos: number;
  do {
    newPos = Math.floor(Math.random() * TILE_COUNT);
  } while (newPos === portalPos);

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
  // stuck at 0, silently losing every own-tile bonus (handleVisitOwnTile
  // requires circles > 0) until they eventually wrap around for real.
  if (landedTile.id === 'king-castle') {
    passStart(board, updateGameState);
  }

  updateGameState(board);
  gameEvent('displayTile', landedTile);

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
