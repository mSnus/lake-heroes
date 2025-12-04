import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';
import { MenuState } from '../types/menuState';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  const player = board.activePlayer;
  console.log('Action: king castle for', player);

  const bonusBase = player.gold * 0.5;
  const halfGold = Math.ceil(bonusBase / 50) * 50;

  const raw = halfGold / 100;

  const unitsReward = raw > 0 ? Math.ceil(raw) : 0;

  if (unitsReward > 0) {
    player.units += unitsReward;
    player.gold -= unitsReward * 100;

    say(`King provided ${player.name} with ${unitsReward}🧍 for ${unitsReward * 100}🟡!`, 'success');
  }
  updateGameState(board);

  setMenu({ type: 'end-turn' });
}
