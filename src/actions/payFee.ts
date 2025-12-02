import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { MenuState } from '../types/menuState';

export function payFee(
  menu: MenuState | null,
  board: GameState | null,
  setGameState: (board: GameState) => void,
  endTurn: () => void
) {
  if (!board || !menu) return;
  const tile = board.tiles[menu.tileIdx!];
  const player = board.activePlayer;
  const tileLevel = tile.level ?? 1;
  const owner = board.players.find((p: Player) => p.name === tile.owner);

  const fee = tile.defences[tileLevel] * 10 || 0;

  if (player.gold >= fee && owner) {
    player.gold -= fee;
    owner.gold += fee;
    setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));
  }
  endTurn();
}
