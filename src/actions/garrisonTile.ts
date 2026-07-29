import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { UnitTier, remainingCapacity } from '../game/army';
import { say } from '../utils/say';

function moveTier(player: Player, tile: Tile, tier: UnitTier, requestedDelta: number): void {
  if (requestedDelta === 0) return;

  if (requestedDelta > 0) {
    const available = tier === 'militia' ? player.militia : player.riders;
    const cap = remainingCapacity(tile.garrisonMilitia, tile.garrisonRiders, tile.garrisonSlots, tier);
    const move = Math.min(requestedDelta, available, cap);
    if (move <= 0) return;
    if (tier === 'militia') {
      player.militia -= move;
      tile.garrisonMilitia += move;
    } else {
      player.riders -= move;
      tile.garrisonRiders += move;
    }
  } else {
    const have = tier === 'militia' ? tile.garrisonMilitia : tile.garrisonRiders;
    const move = Math.min(-requestedDelta, have);
    if (move <= 0) return;
    if (tier === 'militia') {
      tile.garrisonMilitia -= move;
      player.militia += move;
    } else {
      tile.garrisonRiders -= move;
      player.riders += move;
    }
  }
}

/**
 * Set a tile's garrison composition to the given (militia, riders) targets,
 * moving units to/from the owner's traveling army — clamped to whatever's
 * actually available and to the tile's slot capacity (see game/army.ts).
 * Omitting a tier leaves it unchanged.
 */
export function setTileGarrison(
  board: GameState,
  player: Player,
  tile: Tile,
  targetMilitia: number,
  targetRiders: number = tile.garrisonRiders
): void {
  if (tile.owner !== player.id) return;

  moveTier(player, tile, 'militia', Math.max(0, Math.floor(targetMilitia)) - tile.garrisonMilitia);
  moveTier(player, tile, 'riders', Math.max(0, Math.floor(targetRiders)) - tile.garrisonRiders);

  say(
    `${player.name} sets ${tile.name}'s garrison to ${tile.garrisonMilitia}🧍/${tile.garrisonRiders}🐎`,
    'debug'
  );
}
