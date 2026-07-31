import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { say } from '../utils/say';
import { t } from '../i18n';

const TAKE_BACK_MULTIPLIER = 1.2;

/**
 * Yield a tile to the King: ownership stays with the player, but the tile
 * stops producing its yearly/visit bonus, can't be attacked by a Rogue
 * Attack, and its garrison can't be adjusted, in exchange for half its
 * current price (including upgrades) up front.
 */
export function yieldTile(gameState: GameState, player: Player, tile: Tile): number {
  const refund = Math.floor(tile.currentPrice.gold / 2);

  tile.isYielded = true;
  player.gold += refund;

  say(t('yieldTile.yielded', { playerName: player.name, tileName: tile.name, gold: refund }), 'info');

  return refund;
}

export function takeBackCost(tile: Tile): number {
  return Math.ceil(tile.currentPrice.gold * TAKE_BACK_MULTIPLIER);
}

/** Reverts a yield, at 120% of the tile's current price. Returns false (and
 * shows the error toast itself) if the player can't afford it. */
export function takeTileBack(gameState: GameState, player: Player, tile: Tile): boolean {
  const cost = takeBackCost(tile);

  if (player.gold < cost) {
    say(t('yieldTile.cannotAfford', { gold: cost, tileName: tile.name }), 'error');
    return false;
  }

  player.gold -= cost;
  tile.isYielded = false;

  say(t('yieldTile.takenBack', { playerName: player.name, tileName: tile.name, gold: cost }), 'info');

  return true;
}
