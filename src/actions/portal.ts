import { GameState } from '../game/GameState';
import { TILE_COUNT } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';

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
  landedTile.fog = false;

  updateGameState(board);
  gameEvent('displayTile', landedTile);

  showScreen({
    screenType: 'portal',
    background: 'assets/screens/portal.jpg',
    spriteImage: landedTile.spriteImage,
    message: `When your eyes are able to see again, you find yourself at ${landedTile.name}`,
    buttons: [{ label: 'Continue', onClick: () => { clearScreen(); onContinue(); } }],
  });
}
