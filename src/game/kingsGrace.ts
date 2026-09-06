import { GameState } from './GameState';
import { Player } from './Player';
import { ANNUAL_DEFAULT_UNITS, GRACE_TOTAL_UNITS_MULT, GRACE_TOTAL_GOLD_MULT } from './constants';
import { getOverrides } from '../utils/overridesStore';
import { remainingCapacity } from './army';
import { getArtifactGoldBonus } from './artifacts';
import { playerScore } from './score';

export interface KingsGraceReward {
  tileGold: number;
  tileUnits: number;
  /** Towers' extra per-tile share of tileUnits (tiles.json's annualUnits),
   * broken out for its own line in the stats panel/toast rather than
   * blending into the flat per-tile trickle every other gold-bonus tile
   * earns. Camps earn an annualUnits bonus too now, but fold into tileUnits
   * without their own breakout -- the UI line this feeds is Towers-only by
   * name ("from your Towers"). */
  towerUnits: number;
  kingsGold: number;
  /** Grace units as headcount (kingsMilitia + kingsRiders). */
  kingsUnits: number;
  kingsMilitia: number;
  kingsRiders: number;
  /** The grace as measured out, before the army-slot fit trimmed it. */
  graceMilitiaOffered: number;
  graceRidersOffered: number;
  /** The same offer in militia-equivalents (a rider is 2). Above kingsUnits'
   * weighted worth when the army had no room left. */
  graceUnitsOffered: number;
  arifactGold: number;
  /** Share of the full grace this player actually got, by how far their
   * power score sits above the weakest player's -- see graceHandicap. */
  kingsHandicap: number;
  totalGold: number;
  totalUnits: number;
}

// The grace is scaled by how far ahead of the WEAKEST player this one is,
// on power score. Anchors are (score ratio, share of grace); between them
// the share interpolates linearly, so there is no cliff at a bracket edge.
// At or below parity the grace is whole; at 1.8x and beyond it is gone.
const GRACE_HANDICAP_ANCHORS: [ratio: number, share: number][] = [
  [1.0, 1.0],
  [1.2, 0.6],
  [1.3, 0.5],
  [1.4, 0.4],
  [1.5, 0.3],
  [1.6, 0.2],
  [1.7, 0.1],
  [1.8, 0],
];

/** A rider counts as this many militia when the grace is measured out and
 * then fitted back into army slots. */
const GRACE_RIDER_IN_MILITIA = 2;

/** Players sorted weakest-first, with each player's power score. */
function rankByScore(board: GameState): { ranked: Player[]; scoreOf: Map<number, number> } {
  const scoreOf = new Map(board.players.map((p) => [p.id, playerScore(board, p)]));
  const ranked = [...board.players].sort((a, b) => scoreOf.get(a.id)! - scoreOf.get(b.id)!);
  return { ranked, scoreOf };
}

/**
 * The share of the grace a player keeps, from their power score relative to
 * the weakest player's. The weakest sits at ratio 1 and keeps all of it;
 * everyone else is scaled down along GRACE_HANDICAP_ANCHORS.
 */
function graceHandicap(score: number, weakestScore: number): number {
  // Everyone at zero is a flat field, not an infinite gap; anyone above a
  // zero-score weakest is unreachably ahead by ratio.
  if (weakestScore <= 0) return score <= 0 ? 1 : 0;

  const ratio = score / weakestScore;
  const first = GRACE_HANDICAP_ANCHORS[0];
  const last = GRACE_HANDICAP_ANCHORS[GRACE_HANDICAP_ANCHORS.length - 1];
  if (ratio <= first[0]) return first[1];
  if (ratio >= last[0]) return last[1];

  for (let i = 1; i < GRACE_HANDICAP_ANCHORS.length; i++) {
    const [hiRatio, hiShare] = GRACE_HANDICAP_ANCHORS[i];
    if (ratio > hiRatio) continue;
    const [loRatio, loShare] = GRACE_HANDICAP_ANCHORS[i - 1];
    return loShare + ((ratio - loRatio) / (hiRatio - loRatio)) * (hiShare - loShare);
  }

  return last[1];
}

/**
 * The full grace before any handicap: the average gold, militia and riders
 * across all players, garrisoned units included. Averaging is what makes
 * this a balancer -- the grace tracks the table's own wealth, so it grows
 * with the game instead of being a fixed authored payout.
 */
function graceBase(board: GameState): { gold: number; militia: number; riders: number } {
  const count = board.players.length;
  if (count === 0) return { gold: 0, militia: 0, riders: 0 };

  let gold = 0;
  let militia = 0;
  let riders = 0;
  for (const p of board.players) {
    gold += p.gold;
    militia += p.militia;
    riders += p.riders;
  }

  const playerIds = new Set(board.players.map((p) => p.id));
  for (const tile of board.tiles) {
    if (!tile || tile.owner == null || !playerIds.has(tile.owner)) continue;
    militia += tile.garrisonMilitia ?? 0;
    riders += tile.garrisonRiders ?? 0;
  }

  return { gold: gold / count, militia: militia / count, riders: riders / count };
}

/**
 * Fit the grace's own militia/rider mix into the player's army slots.
 *
 * A Knight keeps grace riders as riders, up to the room his free and
 * rider-held slots allow; whatever doesn't fit falls back to militia at
 * GRACE_RIDER_IN_MILITIA each. Militia never convert up into riders -- a
 * player who is not a Knight cannot hold riders at all, so his whole grace
 * is converted down to militia.
 *
 * @param committedMilitia militia this same payout already spends slots on
 * (the per-tile trickle), which land before the grace does.
 */
function fitGraceUnits(
  player: Player,
  graceMilitia: number,
  graceRiders: number,
  committedMilitia: number
): { militia: number; riders: number } {
  const slots = player.armySlots;
  const heldMilitia = player.militia + committedMilitia;
  const militiaRoom = (addedRiders: number) =>
    remainingCapacity(heldMilitia, player.riders + addedRiders, slots, 'militia');
  const riderRoom = (addedMilitia: number) =>
    remainingCapacity(heldMilitia + addedMilitia, player.riders, slots, 'riders');

  if (player.isKnight && graceRiders > 0) {
    const riders = Math.max(0, Math.min(graceRiders, riderRoom(0)));
    const asMilitia = graceMilitia + (graceRiders - riders) * GRACE_RIDER_IN_MILITIA;
    return { militia: Math.max(0, Math.min(asMilitia, militiaRoom(riders))), riders };
  }

  const asMilitia = player.isKnight
    ? graceMilitia
    : graceMilitia + graceRiders * GRACE_RIDER_IN_MILITIA;
  return { militia: Math.max(0, Math.min(asMilitia, militiaRoom(0))), riders: 0 };
}

/**
 * The reward for passing (or about to pass) the King's Castle: the King's
 * grace, plus a flat per-tile trickle from every tile the player
 * owns -- in whichever resource its own bonus ISN'T, since that own resource
 * already pays out every turn instead (see game/income.ts's
 * collectTileTurnIncome). A units-type tile's (Camps/Towers) own
 * annualGold/annualUnits (tiles.json) can add an extra per-level unit toll
 * on top of that trickle, plus any artifact gold bonus (Pristine Diamond).
 * Shared by the actual payout (passStart.ts) and its preview
 * (CurrentPlayer.tsx) so they can't drift apart.
 */
export function computeAnnualReward(board: GameState, player: Player): KingsGraceReward {
  const ranking = rankByScore(board);
  const kingsHandicap =
    board.players.length < 2
      ? 1
      : graceHandicap(
          ranking.scoreOf.get(player.id)!,
          ranking.scoreOf.get(ranking.ranked[0].id)!
        );

  const ov = getOverrides();
  const base = graceBase(board);
  // The grace never drops below a fame-scaled base income, so a table whose
  // averages are still tiny is not left with nothing. lg(fame + 1) rather
  // than lg(fame) so the floor is already worth something at fame 1.
  const fameScale = Math.log10(Math.max(0, player.fame || 0) + 1);
  const baseGold = Math.floor((fameScale * ov.moneyPassStart) / 100) * 100;
  const kingsGold =
    Math.round(Math.max(base.gold, baseGold) * kingsHandicap) * GRACE_TOTAL_GOLD_MULT;

  // The base income is a floor on the grace's total worth, not on either
  // tier -- when it wins, it keeps the averages' militia:rider mix (all
  // militia when nobody fields riders yet).
  const averageUnits = base.militia + base.riders * GRACE_RIDER_IN_MILITIA;
  const graceUnits = Math.max(averageUnits, fameScale * ov.unitsPassStart) * GRACE_TOTAL_UNITS_MULT;
  const unitScale = averageUnits > 0 ? graceUnits / averageUnits : 0;
  const graceMilitia = Math.round(
    (averageUnits > 0 ? base.militia * unitScale : graceUnits) * kingsHandicap
  );
  const graceRiders = Math.round(base.riders * unitScale * kingsHandicap);
  const graceUnitsOffered = graceMilitia + graceRiders * GRACE_RIDER_IN_MILITIA;

  let tileGold = 0;
  let tileUnits = 0;
  let towerUnits = 0;

  // Derive ownership from tile.owner (authoritative) rather than
  // player.ownedTiles, which can be stale after a reload.
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id || tile.isYielded) continue;
    if ((tile.bonusType || 'gold') === 'units') {
      tileGold += tile.annualGold;
      const bonus = tile.annualUnits[tile.level] ?? 0;
      if (tile.group === 'Towers') towerUnits += bonus;
      tileUnits += bonus;
    } else {
      tileUnits += ANNUAL_DEFAULT_UNITS;
    }
  }

  const arifactGold = getArtifactGoldBonus(player);

  // The tile trickle lands first, so the grace is fitted into whatever slot
  // room is left after it.
  const grace = fitGraceUnits(player, graceMilitia, graceRiders, tileUnits);
  const kingsUnits = grace.militia + grace.riders;

  // Rounded down to a clean 50, same as the per-turn tile income (see
  // game/income.ts's playerTurnIncome) -- every consumer reads this field
  // rather than re-summing the parts, so the real payout and every preview
  // stay in sync (see CurrentPlayer.tsx/CurrentPlayerCard.tsx).
  const totalGold = Math.floor((tileGold + kingsGold + arifactGold) / 50) * 50;

  return {
    tileGold,
    tileUnits,
    towerUnits,
    kingsGold,
    kingsUnits,
    kingsMilitia: grace.militia,
    kingsRiders: grace.riders,
    graceMilitiaOffered: graceMilitia,
    graceRidersOffered: graceRiders,
    graceUnitsOffered,
    arifactGold,
    kingsHandicap,
    totalGold,
    totalUnits: tileUnits + kingsUnits,
  };
}
