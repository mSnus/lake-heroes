import { GameState } from './GameState';
import { Player } from './Player';
import { MONEY_PASS_START, MONEY_PASS_START_FAME } from './constants';
import { syndicateMultiplier } from './syndicate';
import { getDiamondGoldBonus } from './artifacts';

export interface KingsGraceReward {
  tileGold: number;
  tileUnits: number;
  kingsGold: number;
  kingsUnits: number;
  diamondGold: number;
  totalGold: number;
  totalUnits: number;
}

/**
 * The reward for passing (or about to pass) the King's Castle: a per-fame
 * grace from the King plus the player's own tile bonuses (syndicate-scaled).
 * Shared by the actual payout (passStart.ts) and its preview (CurrentPlayer.tsx)
 * so they can't drift apart.
 */
export function computeKingsGraceReward(board: GameState, player: Player): KingsGraceReward {
  const fame = player.fame || 1;
  const kingsGold = MONEY_PASS_START + MONEY_PASS_START_FAME * fame;
  const kingsUnits = 2 * fame;

  let tileGold = 0;
  let tileUnits = 0;

  // Derive ownership from tile.owner (authoritative) rather than
  // player.ownedTiles, which can be stale after a reload.
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id || tile.isYielded) continue;

    const bonus = (tile.bonuses[tile.level] || 0) * syndicateMultiplier(board, player, tile.group);
    if ((tile.bonusType || 'gold') === 'units') {
      tileUnits += bonus;
    } else {
      tileGold += bonus;
    }
  }

  const diamondGold = getDiamondGoldBonus(player);

  return {
    tileGold,
    tileUnits,
    kingsGold,
    kingsUnits,
    diamondGold,
    totalGold: tileGold + kingsGold + diamondGold,
    totalUnits: tileUnits + kingsUnits,
  };
}
