import { GameState } from './GameState';
import { Player } from './Player';
import { Tile } from './Tile';
import { UNIT_POWER, isBanzaiAttack } from './army';

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

export interface ClaimAffordability {
  canClaim: boolean;
  goldLacking: boolean;
  unitsInsufficient: boolean;
  fameLacking: boolean;
}

/**
 * Whether `player` has enough gold, enough fame, and (unless a banzai
 * gamble is on the table) enough army power to beat `tile`'s level-1
 * defence -- the single source TileCard's requirement badges and
 * AutoEndTurnNotice's "is a decision still pending" check both read, so
 * "claimable" can't quietly mean something different in the two places.
 * Doesn't check ownership/isOwnable itself -- see canClaimTile below for
 * that, which callers that only want the yes/no answer should use instead.
 */
export function claimAffordability(tile: Tile, player: Player): ClaimAffordability {
  const lvl1Defence = tile.getDefence(1) * (tile.abandoned ? UNIT_POWER.zombies : 1);
  const attackerPower = player.armyPower;
  const isBanzai = isBanzaiAttack(lvl1Defence, attackerPower);
  const unitsInsufficient = !isBanzai && attackerPower < lvl1Defence;
  const goldLacking = player.gold < tile.currentPrice.gold;
  const fameLacking = tile.requiredFame > 0 && player.fame < tile.requiredFame;

  return { canClaim: !goldLacking && !unitsInsufficient && !fameLacking, goldLacking, unitsInsufficient, fameLacking };
}

/** Could `player` actually claim `tile` right now -- unowned, ownable, and
 * affordable per claimAffordability above. */
export function canClaimTile(tile: Tile, player: Player): boolean {
  if (!tile.isOwnable || tile.isOwned()) return false;
  return claimAffordability(tile, player).canClaim;
}
