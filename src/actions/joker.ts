import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showJokerScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { changeFame } from '../utils/fame';
import { richestPlayer, poorestPlayer, totalWealth } from '../game/wealth';
import { checkArtifactProtection } from '../game/artifacts';
import { recordStatEvent } from '../game/statistics';
import { HURRICANE_WEALTH_RATIO } from '../game/constants';
import { setGameMessage } from '../utils/gameMessage';
import { t } from '../i18n';

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
  "Queen's Gift": '💍',
  Earthquake: '🪨',
  Meteor: '☄️',
};

// EVENTS values are internal switch keys (never shown directly) — this maps
// each to its translated display name.
const EVENT_NAME_KEY: Record<JokerEvent, string> = {
  Taxes: 'joker.eventName.taxes',
  Plague: 'joker.eventName.plague',
  Hurricane: 'joker.eventName.hurricane',
  Blessing: 'joker.eventName.blessing',
  "Queen's Gift": 'joker.eventName.queensGift',
  Earthquake: 'joker.eventName.earthquake',
  Meteor: 'joker.eventName.meteor',
};

export function handleJoker(board: GameState, updateGameState: (board: GameState) => void) {
  const event: JokerEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  let message = '';

  switch (event) {
    case 'Taxes':
      for (const p of board.players) {
        if (p.gold > 0) p.gold = Math.max(1, Math.round(p.gold / 2));
      }

      message = t('joker.taxesMessage');
      break;

    case 'Plague': {
      const savedMsgs: string[] = [];
      for (const p of board.players) {
        const protection = checkArtifactProtection(p, 'plague');
        if (protection.saved) {
          savedMsgs.push(t('joker.savedByArtifact', { playerName: p.name, artifactName: protection.artifact!.name, emoji: protection.artifact!.emoji }));
          continue;
        }
        if (p.units > 0) p.units = Math.max(1, Math.round(p.units / 2));
      }

      message = t('joker.plagueMessage');
      if (savedMsgs.length) message += ` ${savedMsgs.join('; ')}`;
      break;
    }

    case 'Hurricane': {
      // Only the richest player is ever at risk, and only while they're
      // truly dominant -- at least HURRICANE_WEALTH_RATIO times wealthier
      // than whoever ranks second. Ties for richest don't count as dominant
      // (ratio can't clear 1x against an equally-wealthy second).
      const ranked = [...board.players].sort((a, b) => totalWealth(board, b) - totalWealth(board, a));
      const richest = ranked[0];
      const second = ranked[1];
      const dominant =
        !!richest && !!second && totalWealth(board, richest) >= totalWealth(board, second) * HURRICANE_WEALTH_RATIO;

      if (dominant && richest.ownedTiles.length > 0) {
        const protection = checkArtifactProtection(richest, 'hurricane');
        if (protection.saved) {
          message = t('joker.savedByArtifact', { playerName: richest.name, artifactName: protection.artifact!.name, emoji: protection.artifact!.emoji });
        } else {
          let maxGold = -1;
          let targetIdx = -1;
          for (const idx of richest.ownedTiles) {
            const candidate = board.tiles[idx];
            if (candidate && candidate.currentPrice.gold > maxGold) {
              maxGold = candidate.currentPrice.gold;
              targetIdx = idx;
            }
          }
          const tile = board.tiles[targetIdx];
          tile.owner = null;
          tile._level = 1;
          tile.isYielded = false;
          richest.ownedTiles = richest.ownedTiles.filter((i) => i !== targetIdx);
          changeFame(richest, -1);
          message = t('joker.playerLosesTile', { playerName: richest.name, tileName: tile.name });
        }
      } else {
        message = t('joker.hurricaneNoEffect');
      }
      break;
    }

    case 'Blessing':
      for (const tile of board.tiles) {
        if (tile?.isOwned() && tile.level < 3) tile._level = tile.level + 1;
      }

      message = t('joker.blessingMessage');
      break;

    case 'Earthquake': {
      const lostMsgs: string[] = [];
      const savedMsgs: string[] = [];
      const poorest = poorestPlayer(board);
      for (const p of board.players) {
        if (p === poorest) continue;
        if (!p.ownedTiles.length) continue;

        const protection = checkArtifactProtection(p, 'earthquake');
        if (protection.saved) {
          savedMsgs.push(t('joker.savedByArtifact', { playerName: p.name, artifactName: protection.artifact!.name, emoji: protection.artifact!.emoji }));
          continue;
        }

        const hasUpgraded = p.ownedTiles.some((idx) => (board.tiles[idx]?.level ?? 1) > 1);

        if (hasUpgraded) {
          // Upgraded tiles crumble one level.
          for (const idx of p.ownedTiles) {
            const tile = board.tiles[idx];
            if (tile && tile.level > 1) tile._level = tile.level - 1;
          }
        } else {
          // No level 2/3 tile to absorb the shock: the cheapest tile collapses.
          let minGold = Infinity;
          let targetIdx = -1;
          for (const idx of p.ownedTiles) {
            const candidate = board.tiles[idx];
            if (candidate && candidate.currentPrice.gold < minGold) {
              minGold = candidate.currentPrice.gold;
              targetIdx = idx;
            }
          }

          if (targetIdx >= 0) {
            const tile = board.tiles[targetIdx];
            tile.owner = null;
            tile._level = 1;
            tile.isYielded = false;
            p.ownedTiles = p.ownedTiles.filter((i) => i !== targetIdx);
            changeFame(p, -1);
            lostMsgs.push(t('joker.playerLosesTile', { playerName: p.name, tileName: tile.name }));
          }
        }
      }

      if (lostMsgs.length) say(t('joker.earthquakeDestroys', { list: lostMsgs.join(', ') }), 'debug');
      message = t('joker.earthquakeMessage');
      if (savedMsgs.length) message += `. ${savedMsgs.join('; ')}`;
      break;
    }

    case 'Meteor': {
      // A meteor strikes one of the richest player's tiles, razing it --
      // never the poorest player's, even if wealth is tied and they'd
      // otherwise also rank as "richest".
      const richest = richestPlayer(board);
      const poorest = poorestPlayer(board);
      if (richest && richest !== poorest && richest.ownedTiles.length > 0) {
        const protection = checkArtifactProtection(richest, 'meteor');
        if (protection.saved) {
          message = t('joker.meteorSaved', { playerName: richest.name, artifactName: protection.artifact!.name, emoji: protection.artifact!.emoji });
        } else {
          const targetIdx = richest.ownedTiles[Math.floor(Math.random() * richest.ownedTiles.length)];
          const tile = board.tiles[targetIdx];
          tile.owner = null;
          tile._level = 1;
          tile.isYielded = false;
          richest.ownedTiles = richest.ownedTiles.filter((i) => i !== targetIdx);
          changeFame(richest, -1);
          message = t('joker.meteorDestroys', { tileName: tile.name });
        }
      } else {
        message = t('joker.meteorWilderness');
      }

      break;
    }

    case "Queen's Gift": {
      const player = board.activePlayer;
      const free = board.tiles
        .map((tile, i) => ({ tile, i }))
        .filter(({ tile }) => tile && (tile.group === 'Camps' || tile.group === 'Towers') && !tile.isOwned());
      if (free.length > 0) {
        const { tile, i } = free[Math.floor(Math.random() * free.length)];
        tile.owner = player.id;
        player.ownedTiles.push(i);
        changeFame(player, 1);
        message = t('joker.queensGiftTile', { playerName: player.name, tileName: tile.name });
      } else {
        player.gold += 2000;
        player.units += 5;
        message = t('joker.queensGiftGold', { playerName: player.name });
      }

      break;
    }
  }

  const eventName = t(EVENT_NAME_KEY[event]);
  say(t('joker.eventLogLine', { eventName, message }), 'info');
  setGameMessage(board, t('joker.eventLogLine', { eventName, message }));
  recordStatEvent(board, board.activePlayer, 'joker');
  updateGameState(board);
  setEndTurn();
  showJokerScreen(message, `${EVENT_EMOJI[event]} ${eventName}`);
}
