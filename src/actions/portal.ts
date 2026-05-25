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

  // Teleport forward 7–16 tiles, but stop 1 tile before King's Castle
  const steps = Math.floor(Math.random() * 10) + 7;
  const rawPos = player.position + steps;
  const newPos = rawPos >= TILE_COUNT ? TILE_COUNT - 1 : rawPos;

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
