import { GameState } from '../game/GameState';
import { TILE_COUNT } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
import { revealTile } from './revealTile';

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

  updateGameState(board);
  gameEvent('displayTile', landedTile);

  showScreen({
    screenType: 'portal',
    background: 'assets/screens/portal.jpg',
    title: 'Colored lights blind you',
    message: `You feel desoriented and lost 🌀`,
    buttons: [
      {
        label: 'Where am I?',
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
    ],
  });
}
