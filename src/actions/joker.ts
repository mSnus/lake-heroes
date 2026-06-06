import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showJokerScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

const EVENTS = ['Taxes', 'Plague', 'Hurricane', 'Blessing', "King's Gift", 'Earthquake'] as const;
type JokerEvent = (typeof EVENTS)[number];

export function handleJoker(board: GameState, updateGameState: (board: GameState) => void) {
  const event: JokerEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  let message = '';

  switch (event) {
    case 'Taxes':
      for (const p of board.players) {
        if (p.gold > 0) p.gold = Math.max(1, Math.round(p.gold / 2));
      }

      message = 'All players lose half of their gold.';
      break;

    case 'Plague':
      for (const p of board.players) {
        if (p.units > 0) p.units = Math.max(1, Math.round(p.units / 2));
      }

      message = 'All players lose half of their units.';
      break;

    case 'Hurricane': {
      for (const p of board.players) {
        if (!p.ownedTiles.length) continue;
        let maxGold = -1;
        let targetIdx = -1;
        for (const idx of p.ownedTiles) {
          const t = board.tiles[idx];
          if (t && t.currentPrice.gold > maxGold) {
            maxGold = t.currentPrice.gold;
            targetIdx = idx;
          }
        }

        if (targetIdx >= 0) {
          const t = board.tiles[targetIdx];
          t.owner = null;
          t._level = 1;
          p.ownedTiles = p.ownedTiles.filter((i) => i !== targetIdx);
          p.fame = Math.max(1, p.fame - 1);
        }
      }

      message = 'Every player loses their most expensive tile.';
      break;
    }

    case 'Blessing':
      for (const t of board.tiles) {
        if (t?.isOwned() && t.level < 3) t._level = t.level + 1;
      }

      message = 'All owned tiles are upgraded one level.';
      break;

    case 'Earthquake':
      for (const t of board.tiles) {
        if (t?.isOwned() && t.level > 1) t._level = t.level - 1;
      }

      message = 'All owned tiles lose one level.';
      break;

    case "King's Gift": {
      const player = board.activePlayer;
      const free = board.tiles
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t && (t.group === 'Camps' || t.group === 'Towers') && !t.isOwned());
      if (free.length > 0) {
        const { t, i } = free[Math.floor(Math.random() * free.length)];
        t.owner = player.name;
        player.ownedTiles.push(i);
        player.fame++;
        message = `${player.name} receives ${t.name} for free!`;
      } else {
        player.gold += 2000;
        player.units += 5;
        message = `All Camps & Towers owned — ${player.name} receives 2000🟡 and 5🧍.`;
      }

      break;
    }
  }

  say(`${event}: ${message}`, 'info');
  board.gameMessage = `${event}: ${message}`;
  updateGameState(board);
  setEndTurn();
  showJokerScreen(message, event);
}
