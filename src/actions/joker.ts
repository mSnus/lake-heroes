import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showJokerScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { changeFame } from '../utils/fame';
import { richestPlayer } from '../game/wealth';

const EVENTS = [
  'Taxes',
  'Plague',
  'Hurricane',
  'Blessing',
  "Queen's Gift",
  'Earthquake',
  'Meteor',
] as const;
type JokerEvent = (typeof EVENTS)[number];

// Emoji shown only on the Joker screen title (not in toasts/gameMessage).
const EVENT_EMOJI: Record<JokerEvent, string> = {
  Taxes: '🧾',
  Plague: '🦠',
  Hurricane: '🌪️',
  Blessing: '👑',
  "Queen's Gift": '📿',
  Earthquake: '🪨',
  Meteor: '☄️',
};

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
      const lostMsgs: string[] = [];
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
          changeFame(p, -1);
          lostMsgs.push(`${p.name} loses ${t.name}`);
        }
      }

      if (lostMsgs.length) say(`Hurricane sweeps away: ${lostMsgs.join(', ')}`, 'debug');
      message = 'Every player loses their most expensive tile.';
      break;
    }

    case 'Blessing':
      for (const t of board.tiles) {
        if (t?.isOwned() && t.level < 3) t._level = t.level + 1;
      }

      message = 'All owned tiles are upgraded one level.';
      break;

    case 'Earthquake': {
      const lostMsgs: string[] = [];
      for (const p of board.players) {
        if (!p.ownedTiles.length) continue;

        const hasUpgraded = p.ownedTiles.some((idx) => (board.tiles[idx]?.level ?? 1) > 1);

        if (hasUpgraded) {
          // Upgraded tiles crumble one level.
          for (const idx of p.ownedTiles) {
            const t = board.tiles[idx];
            if (t && t.level > 1) t._level = t.level - 1;
          }
        } else {
          // No level 2/3 tile to absorb the shock: the cheapest tile collapses.
          let minGold = Infinity;
          let targetIdx = -1;
          for (const idx of p.ownedTiles) {
            const t = board.tiles[idx];
            if (t && t.currentPrice.gold < minGold) {
              minGold = t.currentPrice.gold;
              targetIdx = idx;
            }
          }

          if (targetIdx >= 0) {
            const t = board.tiles[targetIdx];
            t.owner = null;
            t._level = 1;
            p.ownedTiles = p.ownedTiles.filter((i) => i !== targetIdx);
            changeFame(p, -1);
            lostMsgs.push(`${p.name} loses ${t.name}`);
          }
        }
      }

      if (lostMsgs.length) say(`Earthquake destroys: ${lostMsgs.join(', ')}`, 'debug');
      message = 'Upgraded tiles crumble a level; the unprepared lose their cheapest tile.';
      break;
    }

    case 'Meteor': {
      // A meteor strikes one of the richest player's tiles, razing it.
      const richest = richestPlayer(board);
      if (richest && richest.ownedTiles.length > 0) {
        const targetIdx = richest.ownedTiles[Math.floor(Math.random() * richest.ownedTiles.length)];
        const t = board.tiles[targetIdx];
        t.owner = null;
        t._level = 1;
        richest.ownedTiles = richest.ownedTiles.filter((i) => i !== targetIdx);
        changeFame(richest, -1);
        message = `Meteor shower falls on ${t.name}, destroying it`;
      } else {
        message = 'Meteor shower falls on the wilderness, harming no one';
      }

      break;
    }

    case "Queen's Gift": {
      const player = board.activePlayer;
      const free = board.tiles
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t && (t.group === 'Camps' || t.group === 'Towers') && !t.isOwned());
      if (free.length > 0) {
        const { t, i } = free[Math.floor(Math.random() * free.length)];
        t.owner = player.name;
        player.ownedTiles.push(i);
        changeFame(player, 1);
        message = `${player.name} receives ${t.name} for free!`;
      } else {
        player.gold += 2000;
        player.units += 5;
        message = `Queen sends 2000🟡 and 5🧍 to ${player.name}`;
      }

      break;
    }
  }

  say(`${event}: ${message}`, 'info');
  board.gameMessage = `${event}: ${message}`;
  updateGameState(board);
  setEndTurn();
  showJokerScreen(message, `${EVENT_EMOJI[event]} ${event}`);
}
