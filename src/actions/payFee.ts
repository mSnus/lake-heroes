import { FEE_MULTIPLIER } from '../components/board/common';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function payFee(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void,
) {
  if (!board) return;
  const tile = board.activeTile;
  const player = board.activePlayer;
  const tileLevel = tile.level ?? 1;
  const owner = board.players.find((p: Player) => p.name === tile.owner);

  const fee = tile.defences[tileLevel] * FEE_MULTIPLIER || 0;

  if (player.gold >= fee && owner) {
    player.gold -= fee;
    owner.gold += fee;
    say(`${player.name} paid ${fee}🟡 to ${owner.name} for ${tile.name}.`, 'info');
    updateGameState(board);
  }
  
  setMenu({ type: 'end-turn' });
}
