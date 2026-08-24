import { GameState } from './GameState';
import { Player } from './Player';
import { MONEY_PASS_START_FAME, FAME_STEP, ANNUAL_DEFAULT_UNITS } from './constants';
import { getArtifactGoldBonus } from './artifacts';
import { getOverrides } from '../utils/overridesStore';
import { totalWealth } from './wealth';

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
  kingsUnits: number;
  arifactGold: number;
  /** Share of the full fame grace this player actually got, 0.2-1 by wealth
   * rank -- see fameHandicap. */
  kingsHandicap: number;
  /** Extra support for a player the leader has left unreachably far behind
   * -- see computeCatchUp. Zero for everyone else. */
  catchUpGold: number;
  catchUpUnits: number;
  totalGold: number;
  totalUnits: number;
}

// The leader has to be more than this far ahead in total wealth (1 = 100%,
// i.e. more than double) before the King steps in to level the field.
const CATCH_UP_GAP_RATIO = 1;
// Share of the leader's real estate handed to the poorest player, and to
// the one just above them.
const CATCH_UP_SHARE_POOREST = 1 / 3;
const CATCH_UP_SHARE_RUNNER_UP = 1 / 4;

// What the fame grace is scaled by at each end of the wealth table.
const FAME_HANDICAP_RICHEST = 0.2;
const FAME_HANDICAP_POOREST = 1;

/** Players sorted poorest-first, with each player's rank and total wealth. */
function rankByWealth(board: GameState): {
  ranked: Player[];
  rankOf: Map<number, number>;
  wealthOf: Map<number, number>;
} {
  const wealthOf = new Map(board.players.map((p) => [p.id, totalWealth(board, p)]));
  const ranked = [...board.players].sort((a, b) => wealthOf.get(a.id)! - wealthOf.get(b.id)!);
  const rankOf = new Map(ranked.map((p, i) => [p.id, i]));
  return { ranked, rankOf, wealthOf };
}

/**
 * Scales the King's fame grace by how well the player is already doing:
 * the poorest keeps all of it, the richest only FAME_HANDICAP_RICHEST, and
 * everyone between is spread evenly across that range by wealth rank. Fame
 * still sets the size of the grace -- this only decides how much of it a
 * player is allowed to keep.
 */
function fameHandicap(rank: number, playerCount: number): number {
  if (playerCount < 2) return FAME_HANDICAP_POOREST;
  const position = rank / (playerCount - 1);
  return FAME_HANDICAP_POOREST - position * (FAME_HANDICAP_POOREST - FAME_HANDICAP_RICHEST);
}

/**
 * Support for a player who has fallen so far behind the leader that normal
 * play can't realistically close the gap: only the two poorest qualify, and
 * only while the leader is more than CATCH_UP_GAP_RATIO ahead in total
 * wealth. The payout is a share of the LEADER's real estate -- the gold
 * they've sunk into their tiles and upgrades, and those tiles' base-level
 * defence as units -- so the richer the runaway leader, the harder the King
 * pushes back. Nothing is taken from the leader; this is minted.
 */
function computeCatchUp(
  board: GameState,
  player: Player,
  unitCapacity: number,
  ranking: ReturnType<typeof rankByWealth>
): { gold: number; units: number } {
  const none = { gold: 0, units: 0 };
  if (board.players.length < 2) return none;

  const { ranked, rankOf, wealthOf } = ranking;
  const leader = ranked[ranked.length - 1];
  if (leader.id === player.id) return none;

  const rank = rankOf.get(player.id)!;
  if (rank > 1) return none;

  const playerTotal = wealthOf.get(player.id)!;
  const leaderTotal = wealthOf.get(leader.id)!;
  if (leaderTotal <= playerTotal) return none;
  // A player with nothing at all is always unreachably behind -- the ratio
  // would divide by zero.
  if (playerTotal > 0 && (leaderTotal - playerTotal) / playerTotal <= CATCH_UP_GAP_RATIO) return none;

  let realEstateGold = 0;
  let realEstateUnits = 0;
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== leader.id) continue;
    realEstateGold += tile.currentPrice.gold;
    realEstateUnits += tile.defences[1] ?? 0;
  }

  const share = rank === 0 ? CATCH_UP_SHARE_POOREST : CATCH_UP_SHARE_RUNNER_UP;
  return {
    gold: Math.round(realEstateGold * share),
    units: Math.min(Math.round(realEstateUnits * share), Math.max(0, unitCapacity)),
  };
}

/**
 * The reward for passing (or about to pass) the King's Castle: a per-fame
 * grace from the King, a flat per-tile trickle from every tile the player
 * owns -- in whichever resource its own bonus ISN'T, since that own resource
 * already pays out every turn instead (see game/income.ts's
 * collectTileTurnIncome). A units-type tile's (Camps/Towers) own
 * annualGold/annualUnits (tiles.json) can add an extra per-level unit toll
 * on top of that trickle, plus any artifact gold bonus (Pristine Diamond).
 * Shared by the actual payout (passStart.ts) and its preview
 * (CurrentPlayer.tsx) so they can't drift apart.
 */
export function computeAnnualReward(board: GameState, player: Player): KingsGraceReward {
  const ov = getOverrides();
  const ranking = rankByWealth(board);
  const kingsHandicap = fameHandicap(ranking.rankOf.get(player.id) ?? 0, board.players.length);

  const fame = player.fame || 1;
  const fameMultiplier = Math.floor(fame / FAME_STEP);
  const kingsGold = Math.round((ov.moneyPassStart + MONEY_PASS_START_FAME * fameMultiplier) * kingsHandicap);
  const kingsUnits = Math.round(ov.unitsPassStart * fameMultiplier * kingsHandicap);

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

  // Whatever slot room is left once this payout's other units land -- the
  // catch-up share is capped to it rather than being silently dropped by
  // Player.gainMilitia later.
  const unitCapacity = player.remainingCapacity('militia') - (tileUnits + kingsUnits);
  const catchUp = computeCatchUp(board, player, unitCapacity, ranking);

  return {
    tileGold,
    tileUnits,
    towerUnits,
    kingsGold,
    kingsUnits,
    arifactGold,
    kingsHandicap,
    catchUpGold: catchUp.gold,
    catchUpUnits: catchUp.units,
    totalGold: tileGold + kingsGold + arifactGold + catchUp.gold,
    totalUnits: tileUnits + kingsUnits + catchUp.units,
  };
}
