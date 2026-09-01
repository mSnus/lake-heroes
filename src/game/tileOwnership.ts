import { GameState } from './GameState';
import { Player } from './Player';
import { Tile } from './Tile';

/**
 * Burn a tile back to unowned, zombie-guarded wilderness: nobody owns it,
 * its upgrades are gone, its wild garrison is restored to the authored
 * baseline, and it stays on fire (unbuyable) for the rest of the round.
 * Shared by every raze -- a won battle, a rogue horde, and a dragon that
 * destroys a level-1 tile.
 */
export function razeTile(board: GameState, tile: Tile): void {
  const tileIdx = board.tiles.indexOf(tile);
  board.players.forEach((p) => {
    p.ownedTiles = p.ownedTiles.filter((i) => i !== tileIdx);
  });

  tile.owner = null;
  tile._level = 1;
  tile.isYielded = false;
  // Clear the tiered counts before the wild headcount: `garrison`'s setter
  // writes _garrison directly once the tile is unowned and leaves
  // garrisonMilitia/Riders untouched, so the old owner's numbers would
  // otherwise survive the raze and resurface the moment anyone owns it again.
  tile.garrisonMilitia = 0;
  tile.garrisonRiders = 0;
  tile.garrison = tile.baseGarrison;
  tile.unclaimedSinceTurn = board.turns;
  tile.razedInRound = board.round;
  tile.abandoned = true;
}

/**
 * Hand a tile to a player, wiping every trace of whoever (or whatever) held
 * it before: no upgrades, no garrison, not abandoned, not yielded, not on
 * fire. The single definition of "this tile is now owned", so a tile can
 * never arrive owned but still flagged as wilderness -- which is what made
 * a Queen's Gift tower defend itself with zombies.
 *
 * Ownership bookkeeping only; fame, payment and messaging stay with the
 * caller, since each way of acquiring a tile scores differently.
 */
export function grantTile(board: GameState, tile: Tile, player: Player): void {
  const tileIdx = board.tiles.indexOf(tile);
  board.players.forEach((p) => {
    p.ownedTiles = p.ownedTiles.filter((i) => i !== tileIdx);
  });

  tile.owner = player.id;
  tile._level = 1;
  tile.isYielded = false;
  tile.abandoned = false;
  tile.razedInRound = undefined;
  tile.unclaimedSinceTurn = undefined;
  tile.garrisonMilitia = 0;
  tile.garrisonRiders = 0;
  player.ownedTiles.push(tileIdx);
}
