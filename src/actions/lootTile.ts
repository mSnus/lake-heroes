import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { lootPrize, TileIncome } from '../game/income';
import { rollDice } from '../game/Dice';
import { changeFame } from '../utils/fame';
import { changeKarma } from '../utils/karma';
import { closeTopic, sayInTopic } from '../utils/say';
import { t } from '../i18n';

/**
 * Whether `player` could even attempt to loot right now -- once per turn
 * (regardless of which tile), and only when a failed roll would actually
 * cost them something: soldiers to lose, or fame above the floor to lose
 * instead once they have none left.
 */
export function canLoot(player: Player): boolean {
  if (player.hasLootedThisTurn || player.lootBanned) return false;
  return player.units > 0 || player.fame > 1;
}

// Share of the tile's price a successful loot also carries off, in gold.

const formatIncome = (income: TileIncome): string => {
  const parts = [
    income.gold ? `${income.gold}🟡` : '',
    income.food ? `${income.food}🥙` : '',
    income.arms ? `${income.arms}⚔️` : '',
    income.units ? `${income.units}🧍` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : '0🟡';
};

/**
 * Looting an unowned tile -- doesn't touch its ownership or garrison at
 * all, just a dice-roll gamble against the looter's own army/gold/fame:
 * 1-2 a failed loot (soldiers lost, or fame if there are none left to lose),
 * 3 half the tile's per-turn income, 4-5 the income in full, 6 double --
 * plus LOOT_PRICE_SHARE of the tile's price in gold, scaled by the same roll.
 * `roll` is the already-rolled die (see TileCard's visible DiceModal roll);
 * the soldier-loss amount on a 1-2 is its own separate, unseen roll.
 *
 * A failed loot that calls for more units than the looter actually has
 * (the loss roll beats their headcount) costs them every unit they have
 * left, plus 1 fame on top -- not a bigger unit debt than they can pay.
 * Militia are spared before riders either way (Player's `units` setter).
 */
export function lootTile(board: GameState, player: Player, tile: Tile, roll: number): void {
  if (tile.isOnFire(board.round)) return;
  lootOutcome(board, player, tile, roll);
  // Nothing more can be done with the tile, so its messages go out now.
  closeTopic();
}

function lootOutcome(board: GameState, player: Player, tile: Tile, roll: number): void {
  player.hasLootedThisTurn = true;
  const about = { actor: player.name, subject: tile.name };
  changeKarma(player, -1);

  if (roll <= 2) {
    if (player.units > 0) {
      const lossRoll = rollDice();
      const before = player.units;
      const overpaid = lossRoll > before;
      player.units -= Math.min(lossRoll, before);
      const lost = before - player.units;
      if (overpaid) {
        changeFame(player, -1, 1, true);
        sayInTopic(
          t('topics.lootSoldiersAndFameLost', { amount: lost }),
          t('tileCard.lootSoldiersAndFameLost', { playerName: player.name, tileName: tile.name, amount: lost }),
          'error',
          about
        );
      } else {
        sayInTopic(
          t('topics.lootSoldiersLost', { amount: lost }),
          t('tileCard.lootSoldiersLost', { playerName: player.name, tileName: tile.name, amount: lost }),
          'error',
          about
        );
      }
    } else {
      const before = player.fame;
      changeFame(player, -1, 1, true);
      const lost = before - player.fame;
      sayInTopic(
        t('topics.lootFameLost', { amount: lost }),
        t('tileCard.lootFameLost', { playerName: player.name, tileName: tile.name, amount: lost }),
        'error',
        about
      );
    }

    return;
  }

  const mult = roll === 3 ? 0.5 : roll === 6 ? 2 : 1;
  const income = lootPrize(tile, board, mult);

  player.gold += income.gold;
  player.food += income.food;
  player.arms += income.arms;
  player.units += income.units;

  sayInTopic(
    t('topics.lootGain', { reward: formatIncome(income) }),
    t('tileCard.lootGain', { playerName: player.name, tileName: tile.name, reward: formatIncome(income) }),
    'success',
    about
  );
}
