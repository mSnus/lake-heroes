import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { getFeeMultiplier } from '../game/artifacts';

/** Pipe of Hamelin halves fees the payer owes to other players' tiles. */
export function getEffectiveFee(tile: Tile, payer: Player): number {
  return Math.round(tile.fee * getFeeMultiplier(payer));
}

export interface FeeOptions {
  fee: number;
  defence: number;
  /** A banzai attack is always on the table as long as there's an army to
   * send in, regardless of how it stacks up against the defence -- this is
   * now a purely optional "seek revenge" action, not an alternative to
   * paying the toll (see afterMoveLogic.ts). */
  canFight: boolean;
  sellable: { gold: number; units: number };
  hasSellableTiles: boolean;
}

/** Shared by the Guards-encounter UI and the bot's guards decision. */
export function computeFeeOptions(board: GameState, player: Player, tile: Tile): FeeOptions {
  const fee = getEffectiveFee(tile, player);
  const defence = tile.defence;

  let hasSellableTiles = false;
  const sellable = player.ownedTiles.reduce(
    (acc, posIdx) => {
      const t = board.tiles[posIdx];
      if (!t || t.owner !== player.id) return acc;
      hasSellableTiles = true;
      acc.gold += t.currentPrice.gold;
      acc.units += t.currentPrice.units;
      return acc;
    },
    { gold: 0, units: 0 }
  );

  const canFight = player.armyPower > 0;

  return { fee, defence, canFight, sellable, hasSellableTiles };
}
