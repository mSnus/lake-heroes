import { GameState } from './GameState';
import { Player } from './Player';
import {
  MONEY_PASS_START,
  MONEY_PASS_START_FAME,
  FAME_STEP,
  UNITS_PASS_START,
  ANNUAL_DEFAULT_UNITS,
  ANNUAL_DEFAULT_GOLD,
  TOWER_LEVEL_UNIT_BONUS,
} from './constants';
import { getArtifactGoldBonus } from './artifacts';

export interface KingsGraceReward {
  tileGold: number;
  tileUnits: number;
  /** Towers' extra level-scaled share of tileUnits, broken out for its own
   * line in the stats panel/toast rather than blending into the flat
   * per-tile trickle every other gold-bonus tile earns. */
  towerUnits: number;
  kingsGold: number;
  kingsUnits: number;
  arifactGold: number;
  totalGold: number;
  totalUnits: number;
}

/**
 * The reward for passing (or about to pass) the King's Castle: a per-fame
 * grace from the King, a flat per-tile trickle from every tile the player
 * owns -- in whichever resource its own bonus ISN'T, since that own resource
 * already pays out every turn instead (see game/income.ts's
 * collectTileTurnIncome) -- Towers' extra TOWER_LEVEL_UNIT_BONUS-per-level
 * toll on top of that trickle, plus any artifact gold bonus (Pristine
 * Diamond). Shared by the actual payout (passStart.ts) and its preview
 * (CurrentPlayer.tsx) so they can't drift apart.
 */
export function computeAnnualReward(board: GameState, player: Player): KingsGraceReward {
  const fame = player.fame || 1;
  const fameMultiplier = Math.floor(fame / FAME_STEP);
  const kingsGold = MONEY_PASS_START + MONEY_PASS_START_FAME * fameMultiplier;
  const kingsUnits = UNITS_PASS_START * fameMultiplier;

  let tileGold = 0;
  let tileUnits = 0;
  let towerUnits = 0;

  // Derive ownership from tile.owner (authoritative) rather than
  // player.ownedTiles, which can be stale after a reload.
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id || tile.isYielded) continue;
    if ((tile.bonusType || 'gold') === 'units') {
      tileGold += ANNUAL_DEFAULT_GOLD;
      if (tile.group === 'Towers') {
        const bonus = TOWER_LEVEL_UNIT_BONUS * tile.level;
        towerUnits += bonus;
        tileUnits += bonus;
      }
    } else {
      tileUnits += ANNUAL_DEFAULT_UNITS;
    }
  }

  const arifactGold = getArtifactGoldBonus(player);

  return {
    tileGold,
    tileUnits,
    towerUnits,
    kingsGold,
    kingsUnits,
    arifactGold,
    totalGold: tileGold + kingsGold + arifactGold,
    totalUnits: tileUnits + kingsUnits,
  };
}
