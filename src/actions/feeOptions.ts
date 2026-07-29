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
  canPay: boolean;
  canFight: boolean;
  canSellForFee: boolean;
  canSellForFight: boolean;
  canSell: boolean;
  showAcceptLoss: boolean;
  sellable: { gold: number; units: number };
}

/** Shared by the Guards-encounter UI and the bot's guards decision. */
export function computeFeeOptions(board: GameState, player: Player, tile: Tile): FeeOptions {
  const fee = getEffectiveFee(tile, player);
  const defence = tile.defence;

  const sellable = player.ownedTiles.reduce(
    (acc, posIdx) => {
      const t = board.tiles[posIdx];
      if (!t || t.owner !== player.id) return acc;
      acc.gold += t.currentPrice.gold;
      acc.units += t.currentPrice.units;
      return acc;
    },
    { gold: 0, units: 0 }
  );

  const canPay = player.gold >= fee;
  const canFight = player.armyPower >= defence;
  const canSellForFee = !canPay && player.gold + sellable.gold >= fee;
  const canSellForFight = !canFight && player.armyPower + sellable.units >= defence;
  // Even if selling everything wouldn't fully cover the fee, offer the option
  // when fighting is available — the player may still prefer to sell first.
  const canSell = canSellForFee || canSellForFight || (canFight && !canPay);
  const showAcceptLoss = !canPay && !canFight && !canSell;

  return {
    fee,
    defence,
    canPay,
    canFight,
    canSellForFee,
    canSellForFight,
    canSell,
    showAcceptLoss,
    sellable,
  };
}
