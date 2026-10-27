import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { TileIncome, tileTurnIncome } from '../game/income';
import { rollDice } from '../game/Dice';
import { changeFame } from '../utils/fame';
import { changeKarma } from '../utils/karma';
import { say } from '../utils/say';
import { t } from '../i18n';

/**
 * Whether `player` could even attempt a raid right now -- once per turn
 * (regardless of which tile), and only when a failed roll would actually
 * cost them something: soldiers to lose, or fame above the floor to lose
 * instead once they have none left.
 */
export function canPillage(player: Player): boolean {
  if (player.hasPillagedThisTurn) return false;
  return player.units > 0 || player.fame > 1;
}

const formatIncome = (income: TileIncome): string => {
  if (income.gold) return `${income.gold}🟡`;
  if (income.food) return `${income.food}🫓`;
  if (income.arms) return `${income.arms}⚔️`;
  if (income.units) return `${income.units}🧍`;
  return '0🟡';
};

/**
 * A raid on an unowned tile -- doesn't touch its ownership or garrison at
 * all, just a dice-roll gamble against the raider's own army/gold/fame:
 * 1-2 a failed raid (soldiers lost, or fame if there are none left to lose),
 * 3 half the tile's per-turn income, 4-5 the income in full, 6 double.
 * `roll` is the already-rolled die (see TileCard's visible DiceModal roll);
 * the soldier-loss amount on a 1-2 is its own separate, unseen roll.
 */
export function pillageTile(
  board: GameState,
  player: Player,
  tile: Tile,
  roll: number
): void {
  player.hasPillagedThisTurn = true;
  changeKarma(player, -1);

  if (roll <= 2) {
    if (player.units > 0) {
      const lossRoll = rollDice();
      const before = player.units;
      player.units -= lossRoll;
      const lost = before - player.units;
      say(
        t('tileCard.pillageSoldiersLost', { playerName: player.name, tileName: tile.name, amount: lost }),
        'error'
      );
    } else {
      const before = player.fame;
      changeFame(player, -1, 1, true);
      const lost = before - player.fame;
      say(
        t('tileCard.pillageFameLost', { playerName: player.name, tileName: tile.name, amount: lost }),
        'error'
      );
    }

    return;
  }

  const mult = roll === 3 ? 0.5 : roll === 6 ? 2 : 1;
  const base = tileTurnIncome(tile, 1, undefined, board);
  const income: TileIncome = {
    gold: Math.round(base.gold * mult),
    food: Math.round(base.food * mult),
    arms: Math.round(base.arms * mult),
    units: Math.round(base.units * mult),
  };

  player.gold += income.gold;
  player.food += income.food;
  player.arms += income.arms;
  player.units += income.units;

  say(
    t('tileCard.pillageGain', { playerName: player.name, tileName: tile.name, reward: formatIncome(income) }),
    'success'
  );
}
