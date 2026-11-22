import { GameState } from './GameState';
import { Player } from './Player';
import { Tile, TileBonusType } from './Tile';
import { syndicateMultiplier } from './syndicate';

export const GROUP_EFFECT_MULT = 1.5;

/** Owning any tile of `group` makes every tile of `bonusType` the player owns pay GROUP_EFFECT_MULT. */
export const GROUP_EFFECTS: { group: string; bonusType: TileBonusType }[] = [
  { group: 'Mills', bonusType: 'food' },
  { group: 'Crafts', bonusType: 'arms' },
  { group: 'Camps', bonusType: 'units' },
];

/** GROUP_EFFECT_MULT when the player holds (not yielded) a tile of the group that boosts `bonusType`. */
export function groupEffectMultiplier(board: GameState, player: Player, bonusType: TileBonusType): number {
  const effect = GROUP_EFFECTS.find((e) => e.bonusType === bonusType);
  if (!effect) return 1;

  const ownsOne = board.tiles.some((t) => t?.owner === player.id && !t.isYielded && t.group === effect.group);
  return ownsOne ? GROUP_EFFECT_MULT : 1;
}

/** Everything the owner multiplies a tile's own income by: syndicate and group effect. */
export function ownerIncomeMultiplier(board: GameState, player: Player, tile: Tile): number {
  return syndicateMultiplier(board, player, tile.group) * groupEffectMultiplier(board, player, tile.bonusType);
}
