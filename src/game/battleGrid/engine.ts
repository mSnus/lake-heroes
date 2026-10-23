import { rollInRange } from '../Dice';
import {
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  BATTLE_START_UNITS,
  DRAGON_HP,
  DRAGON_DMG_MIN,
  DRAGON_DMG_MAX,
  ABSORB_BASE,
  ABSORB_PER_ROLL_POINT,
  MILITIA_ENERGY,
  OTHER_KIND_ENERGY,
  ENERGY_DEPLETED_DAMAGE_MULT,
} from '../constants';
import { getOverrides } from '../../utils/overridesStore';
import { freeEdgeCells, generateObstacles, placeAtEdge } from './placement';
import { Cell, hexDistance, neighborOffsetsFor, visualPos } from './hex';
import { BattleSide, GridBattleState, GridUnit, StepTurnOptions, TurnEvent, TurnResult, UnitKind } from './types';

export { adjacentCells } from './hex';

// Obstacle cells as a "col,row" key set, for seeding into every blocked-set
// a movement/pathfinding helper below is given -- the single thing that
// makes an obstacle cell actually impassable everywhere.
function obstacleKeySet(state: GridBattleState): Set<string> {
  return new Set(state.obstacles.map((o) => `${o.col},${o.row}`));
}

// A unit that moved this turn defends less effectively -- it hasn't set its
// footing to brace for the hit. One point off its second-stage absorption
// roll, i.e. 10% less of the hit soaked.
const MOVED_DEFENSE_PENALTY = 1;

// Chance that a connecting hit against an already-wounded target is a
// critical hit, killing it outright regardless of remaining HP. Only ever
// considered for a target below its max HP -- a full-health unit can't be
// critted. This is what lets a battle go the "wrong" way even at favourable
// odds (e.g. 14 vs 12 militia can still be lost).
const CRITICAL_HIT_CHANCE = 0.25;
// A hit from behind (from the side of the target's own starting edge) crits
// this many times as often.
const BEHIND_CRIT_MULT = 2;

/** Whether `attacker` strikes `target` from the target's back -- the side of
 * its own starting edge (left for the grid's attacker, right for its defender). */
function isFromBehind(attacker: Cell, target: GridUnit): boolean {
  const dx = visualPos(attacker).x - visualPos(target).x;
  return target.side === 'attacker' ? dx < 0 : dx > 0;
}

// Lifetime cap on wounded-pullback moves per unit — after this many total
// break-offs to safety, a wounded unit commits to fighting instead, which
// guarantees the battle can't stall in an endless pull-back/re-advance dance.
const SAFETY_MOVE_CAP = 3;

function hpFor(kind: UnitKind): number {
  const ov = getOverrides();
  if (kind === 'dragon') return DRAGON_HP;
  if (kind === 'zombie') return ov.zombieHp;
  return kind === 'rider' ? ov.riderHp : ov.militiaHp;
}

/** A unit's energy at battle start, and what it's fully restored to (see
 * GridUnit.energy) -- militia get less stamina than every other kind
 * (riders, zombies, dragons alike). */
export function energyFor(kind: UnitKind): number {
  return kind === 'militia' ? MILITIA_ENERGY : OTHER_KIND_ENERGY;
}

/** Damage roll for one unit. A per-unit dmgMin/dmgMax (see GridUnit --
 * battle simulator only) takes over the range entirely, used as-is; every
 * real-game unit has neither set, so this is the same kind+getOverrides()
 * lookup as before. */
function rollDamage(u: GridUnit, pctBonus: number, flatBonus: number, rng: () => number): number {
  const ov = getOverrides();
  let min: number, max: number, mult = 1;
  if (u.dmgMin !== undefined && u.dmgMax !== undefined) {
    min = u.dmgMin;
    max = u.dmgMax;
  } else if (u.kind === 'dragon') {
    min = DRAGON_DMG_MIN;
    max = DRAGON_DMG_MAX;
  } else if (u.kind === 'rider') {
    min = ov.riderDmgMin;
    max = ov.riderDmgMax;
  } else if (u.kind === 'zombie') {
    min = ov.zombieDmgMin;
    max = ov.zombieDmgMax;
  } else {
    min = ov.militiaDmgMin;
    max = ov.militiaDmgMax;
  }

  const base = rollInRange(min, max, rng) * mult;
  return Math.max(0, Math.round(base * (1 + pctBonus) + flatBonus));
}

/**
 * What share of one incoming hit a defender soaks, in two stages:
 *
 *  1. a d6 -- a 1 soaks nothing at all, a 6 soaks the lot, and anything
 *     between goes on to
 *  2. a second d6, soaking ABSORB_BASE + ABSORB_PER_ROLL_POINT per point,
 *     i.e. 30%-80%.
 *
 * `bonus` shifts only that second roll (a garrison's tile level, less a
 * point if the unit moved this turn), so even the sturdiest tower still
 * takes a clean hit on a first-stage 1. Clamped to 0..1.
 *
 * Deliberately NOT a counter-roll against the attacker's own damage roll,
 * which is what the old defence worked as: that let a weakened attacker
 * (see GridUnit.energy) be outrolled so reliably that two drained armies
 * could stand and swing at each other forever without landing a point.
 * A share always leaves something through -- see the floor in resolveCombat.
 */
function rollAbsorption(bonus: number, rng: () => number): number {
  const stage1 = rollInRange(1, 6, rng);
  if (stage1 === 1) return 0;
  if (stage1 === 6) return 1;

  const stage2 = rollInRange(1, 6, rng) + bonus;
  return Math.max(0, Math.min(1, ABSORB_BASE + ABSORB_PER_ROLL_POINT * stage2));
}

interface SideComp {
  militia: number;
  riders: number;
  zombie?: boolean;
  /** Marks this side's rider-slot units as Dragons (own kind, HP and damage). */
  dragon?: boolean;
  /** Battle simulator only (see simulate.ts) — overrides the militia-slot
   * and/or rider-slot units' hp/damage range for this side, independent of
   * getOverrides(). Undefined in every real (non-simulator) call. */
  militiaHp?: number;
  militiaDmgMin?: number;
  militiaDmgMax?: number;
  riderHp?: number;
  riderDmgMin?: number;
  riderDmgMax?: number;
}

/** Build a fresh battle. Each side's riders come first, then its militia:
 * the first BATTLE_START_UNITS line up along that side's own edge (riders in
 * front), the rest wait in `reserves` in that same order (see
 * deployReinforcements). */
export function createBattle(
  attacker: SideComp,
  defender: SideComp,
  cols: number = BATTLEFIELD_COLS,
  rows: number = BATTLEFIELD_ROWS
): GridBattleState {
  let stableIndex = 0;
  const units: GridUnit[] = [];
  const reserves: GridUnit[] = [];
  const obstacles = generateObstacles(cols, rows);

  const makeUnit = (side: BattleSide, kind: UnitKind, hp: number, dmgMin?: number, dmgMax?: number): GridUnit => ({
    id: `${side}-${stableIndex}`,
    side,
    kind,
    hp,
    maxHp: hp,
    dmgMin,
    dmgMax,
    col: 0,
    row: 0,
    stableIndex: stableIndex++,
    retreatStreak: 0,
    safetyMoves: 0,
    swapCooldown: 0,
    energy: energyFor(kind),
  });

  const buildSide = (side: BattleSide, comp: SideComp) => {
    // An abandoned tile's wild garrison guards as Zombies instead of regular
    // militia; the dragon fight's dragons arrive in the rider slot.
    const militiaKind: UnitKind = comp.zombie ? 'zombie' : 'militia';
    const riderKind: UnitKind = comp.dragon ? 'dragon' : 'rider';
    const militiaHp = comp.militiaHp ?? hpFor(militiaKind);
    const riderHp = comp.riderHp ?? hpFor(riderKind);
    const queue: GridUnit[] = [
      ...Array.from({ length: comp.riders }, () => makeUnit(side, riderKind, riderHp, comp.riderDmgMin, comp.riderDmgMax)),
      ...Array.from({ length: comp.militia }, () =>
        makeUnit(side, militiaKind, militiaHp, comp.militiaDmgMin, comp.militiaDmgMax)
      ),
    ];

    const opening = queue.slice(0, BATTLE_START_UNITS);
    // Back to front: the queue's tail (militia) at the edge, riders ahead of it.
    placeAtEdge([...opening].reverse(), side, cols, rows, obstacles);
    units.push(...opening);
    reserves.push(...queue.slice(BATTLE_START_UNITS));
  };

  buildSide('attacker', attacker);
  buildSide('defender', defender);

  return { cols, rows, units, reserves, obstacles, turn: 0, status: 'ongoing' };
}

/** Move reserves onto every free cell of their own side's edge column, in
 * reserve order -- called at the start of each round. */
export function deployReinforcements(state: GridBattleState): GridBattleState {
  if (state.reserves.length === 0) return state;
  const units = [...state.units];
  let reserves = [...state.reserves];
  for (const side of ['attacker', 'defender'] as const) {
    const cells = freeEdgeCells(side, state.cols, state.rows, state.obstacles, units);
    for (const cell of cells) {
      const idx = reserves.findIndex((u) => u.side === side);
      if (idx < 0) break;
      units.push({ ...reserves[idx], col: cell.col, row: cell.row });
      reserves = [...reserves.slice(0, idx), ...reserves.slice(idx + 1)];
    }
  }

  return { ...state, units, reserves };
}

/** How many of a side's units are still in the fight, field and reserve. */
export function sideRemaining(state: GridBattleState, side: BattleSide): number {
  return (
    state.units.filter((u) => u.side === side).length + state.reserves.filter((u) => u.side === side).length
  );
}

function battleStatus(units: GridUnit[], reserves: GridUnit[]): GridBattleState['status'] {
  const attackerAlive = units.some((u) => u.side === 'attacker') || reserves.some((u) => u.side === 'attacker');
  const defenderAlive = units.some((u) => u.side === 'defender') || reserves.some((u) => u.side === 'defender');
  return !attackerAlive && !defenderAlive
    ? 'tie'
    : !defenderAlive
      ? 'attacker-win'
      : !attackerAlive
        ? 'defender-win'
        : 'ongoing';
}

export function isBattleOver(state: GridBattleState): boolean {
  return state.status !== 'ongoing';
}

function livingAdjacentEnemies(u: GridUnit, living: GridUnit[]): GridUnit[] {
  return living.filter((v) => v.side !== u.side && hexDistance(u, v) === 1);
}

function nearestEnemyDistance(u: GridUnit, living: GridUnit[]): number {
  let best = Infinity;
  for (const v of living) {
    if (v.side === u.side) continue;
    const d = hexDistance(u, v);
    if (d < best) best = d;
  }

  return best;
}

/** Steps from `target` to every cell reachable around `terrain` (units
 * ignored -- they move). */
function walkingDistances(target: Cell, cols: number, rows: number, terrain: Set<string>): Map<string, number> {
  const dist = new Map<string, number>([[`${target.col},${target.row}`, 0]]);
  const queue: Cell[] = [target];
  while (queue.length) {
    const c = queue.shift()!;
    const d = dist.get(`${c.col},${c.row}`)!;
    for (const off of neighborOffsetsFor(c.row)) {
      const n = { col: c.col + off.col, row: c.row + off.row };
      if (n.col < 0 || n.col >= cols || n.row < 0 || n.row >= rows) continue;
      const k = `${n.col},${n.row}`;
      if (dist.has(k) || terrain.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(n);
    }
  }

  return dist;
}

// Hard cap on how many cells a single unit's pathfind explores. Without one,
// a unit whose target is fully surrounded (every adjacent cell already
// occupied — a common state once a small defending force is swarmed by a
// much larger attacker) would have BFS search arbitrarily far to find *some*
// unclaimed cell adjacent to that exact target, which can mean circling
// almost all the way around the enemy cluster to approach from the empty
// far side — and the first step of that route can point sharply away from
// the enemy, reading as the unit "running away". Capping the search makes
// a saturated target behave the way it should: the unit queues up as close
// as it can get and waits its turn, instead of trekking around the world.
const PATHFIND_NODE_BUDGET = 96;

/**
 * Real shortest-path first step from `start` toward `target`, via
 * breadth-first search over the 6-neighbor offset grid — not a greedy
 * single-step heuristic. A unit boxed in behind a wide obstacle (a wall of
 * friendly/enemy units several cells thick, say) needs to route *around*
 * it; picking whichever single neighbor cell looks closest to the target by
 * raw distance can walk straight into a dead end and get stuck oscillating
 * against the obstacle forever, since it has no visibility past one step.
 *
 * The ideal goal is a cell adjacent to `target`, reached exactly (returned
 * immediately as soon as found, no budget cap applies). Short of that, this
 * searches one full ring (BFS level) at a time and returns as soon as *any*
 * cell in the ring just finished reduces the distance to target — it does
 * NOT keep spending budget hunting for an even-lower absolute distance in
 * later, deeper rings. That matters: with several branches fanning out
 * simultaneously and sharing one budget, a branch that initially heads the
 * "wrong" way can, given enough leftover budget, wander far enough to
 * numerically land closer to the target than a correct-direction branch
 * that was simply explored less deeply — which would make an early
 * backward step look like the "best" answer purely by chance, not because
 * it's actually a sensible route. Stopping at the shallowest improving
 * ring keeps the answer tied to genuinely nearby progress. Only the first
 * step is ever used — the rest is recomputed fresh next turn anyway, since
 * the board keeps changing.
 */
function firstStepToward(
  start: Cell,
  target: Cell,
  cols: number,
  rows: number,
  blocked: Set<string>,
  terrain: Set<string>
): Cell | undefined {
  const targetKey = `${target.col},${target.row}`;
  const visited = new Set<string>([`${start.col},${start.row}`, targetKey]);
  // Distance measured walking around terrain, so a route that has to bend
  // around a wall still counts as progress.
  const walk = walkingDistances(target, cols, rows, terrain);
  const distTo = (c: Cell) => walk.get(`${c.col},${c.row}`) ?? hexDistance(c, target) + cols * rows;

  const startDist = distTo(start);
  // A route may bend around an obstacle, but its FIRST step must never walk
  // away from the target. Only the first step is ever taken -- the rest is
  // rebuilt from scratch next turn against a board that has moved -- so a
  // path that opens by retreating is rarely followed through. What actually
  // happened was a unit drifting backwards out of the line, turn after turn,
  // each step "justified" by a route it never completed, leaving the army
  // more spread out and weaker. Standing still costs a turn; stepping back
  // costs that turn AND the turn needed to undo it.
  //
  // Lateral steps (same distance) stay allowed -- on a hex grid that is how
  // a unit rounds a blocked cell without giving ground.
  const stepIsRetreat = (firstStep: Cell) => distTo(firstStep) > startDist;

  let bestFirstStep: Cell | undefined;
  let bestDist = startDist;
  let bestEuclidSq = Infinity;
  const targetPos = visualPos(target);

  // Hex distance alone ties often — several of a cell's neighbors can share
  // the same distance to a far-off target. Without a secondary tiebreak,
  // whichever tied cell happens to be unclaimed and first in enumeration
  // order wins — and since many different units in adjacent rows are
  // independently racing for that same small tied set, whoever gets
  // processed later keeps getting bumped onto an essentially arbitrary
  // leftover instead of its own natural straight-ahead cell, scattering
  // what should be a clean advancing line. Preferring the lowest on-screen
  // (visual, offset-aware) distance among hex-tied candidates makes each
  // unit default to its own straight/row-aligned step.
  const consider = (c: Cell, firstStep: Cell): Cell | undefined => {
    if (stepIsRetreat(firstStep)) return undefined;
    const d = distTo(c);
    if (hexDistance(c, target) === 1) return firstStep;
    const cPos = visualPos(c);
    const dx = cPos.x - targetPos.x;
    const dy = cPos.y - targetPos.y;
    const euclidSq = dx * dx + dy * dy;
    // The `bestFirstStep !== undefined` guard matters on the very first
    // candidate: a tie against the *starting* distance isn't progress, so
    // it shouldn't be accepted just because nothing better has been seen yet.
    const better = d < bestDist || (d === bestDist && bestFirstStep !== undefined && euclidSq < bestEuclidSq);
    if (better) {
      bestDist = d;
      bestEuclidSq = euclidSq;
      bestFirstStep = firstStep;
    }

    return undefined;
  };

  // Level 0 -> level 1: every candidate's firstStep is itself.
  let level: { cell: Cell; firstStep: Cell }[] = [{ cell: start, firstStep: start }];

  while (level.length > 0 && visited.size < PATHFIND_NODE_BUDGET) {
    const nextLevel: { cell: Cell; firstStep: Cell }[] = [];
    for (const { cell, firstStep } of level) {
      for (const off of neighborOffsetsFor(cell.row)) {
        const c = { col: cell.col + off.col, row: cell.row + off.row };
        if (c.col < 0 || c.col >= cols || c.row < 0 || c.row >= rows) continue;
        const key = `${c.col},${c.row}`;
        if (visited.has(key)) continue;
        visited.add(key);
        // A blocked cell can't be entered — not even as the final step,
        // even if it happens to already be adjacent to the target.
        // Checking this before the adjacency test matters: otherwise an
        // occupied cell right next to the enemy would get returned as a
        // "valid" destination and two units could end up sharing it.
        if (blocked.has(key)) continue;
        // cell === start only on the very first ring — every other ring's
        // step already carries its own firstStep forward from its parent.
        const actualFirstStep = cell === start ? c : firstStep;
        const hit = consider(c, actualFirstStep);
        if (hit) return hit;
        nextLevel.push({ cell: c, firstStep: actualFirstStep });
      }
    }

    // Stop at the shallowest ring that found any real improvement — see
    // the function comment for why continuing deeper would be wrong here.
    if (bestFirstStep !== undefined) return bestFirstStep;
    level = nextLevel;
  }

  return bestFirstStep; // undefined only if truly nothing is reachable at all
}

/**
 * Nearest enemy by hex distance, with a visual (on-screen, offset-aware)
 * Euclidean tiebreak. The distance-only version ties constantly — while
 * two blocks are still far apart, distance is almost entirely dominated by
 * the horizontal gap, so dozens of enemy units at very different rows can
 * share the exact same hex distance from a given unit. Without a tiebreak,
 * every unit on a side resolves that tie identically (whichever enemy
 * happens to be first in iteration order) and the *entire army* funnels
 * toward that one single enemy unit instead of each unit heading for
 * whichever enemy is actually closest to it. The visual tiebreak breaks
 * that sensibly, so units naturally advance on a broad front toward
 * whoever's really nearest on screen.
 */
function livingAdjacentFriends(u: GridUnit, living: GridUnit[]): GridUnit[] {
  return living.filter((v) => v.id !== u.id && v.side === u.side && hexDistance(u, v) === 1);
}

/** True when `u` is the only living unit left on its side -- last stand:
 * retreating, pulling back wounded, or swapping to safety aren't options
 * (there's nowhere to retreat TO in any meaningful sense and no one left to
 * protect by doing so), so every fleeing-behaviour check gates on this being
 * false first and falls through to stand and fight instead. */
function isLastAlive(u: GridUnit, living: GridUnit[]): boolean {
  return !living.some((v) => v.id !== u.id && v.side === u.side);
}

// An adjacent, in-bounds, unoccupied/unblocked cell that is "not under attack"
// — no living enemy of `u` sits next to it — preferring the safe cell farthest
// from the nearest enemy. Used by the wounded-pullback rule: a hurt unit with
// a friend beside it steps back here to let its friends screen for it.
function safeAdjacentCell(
  u: GridUnit,
  living: GridUnit[],
  cols: number,
  rows: number,
  blocked: Set<string>
): Cell | undefined {
  const enemy = nearestLivingEnemy(u, living);
  let best: Cell | undefined;
  let bestScore = -Infinity;
  for (const off of neighborOffsetsFor(u.row)) {
    const c = { col: u.col + off.col, row: u.row + off.row };
    if (c.col < 0 || c.col >= cols || c.row < 0 || c.row >= rows) continue;
    if (blocked.has(`${c.col},${c.row}`)) continue;
    if (living.some((v) => v.hp > 0 && v.id !== u.id && v.col === c.col && v.row === c.row)) continue;
    // "not under attack": no living enemy adjacent to c
    const underAttack = neighborOffsetsFor(c.row).some((o2) =>
      living.some((v) => v.hp > 0 && v.side !== u.side && v.col === c.col + o2.col && v.row === c.row + o2.row)
    );
    if (underAttack) continue;
    const score = enemy ? hexDistance(c, enemy) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

function nearestLivingEnemy(u: GridUnit, living: GridUnit[]): GridUnit | undefined {
  let best: GridUnit | undefined;
  let bestHex = Infinity;
  let bestEuclidSq = Infinity;
  const uPos = visualPos(u);
  for (const v of living) {
    if (v.side === u.side) continue;
    const hex = hexDistance(u, v);
    if (hex > bestHex) continue;
    const vPos = visualPos(v);
    const dx = vPos.x - uPos.x;
    const dy = vPos.y - uPos.y;
    const euclidSq = dx * dx + dy * dy;
    if (hex < bestHex || euclidSq < bestEuclidSq) {
      bestHex = hex;
      bestEuclidSq = euclidSq;
      best = v;
    }
  }

  return best;
}

/**
 * One all-at-once combat batch over `combatPool` (a subset of `living`).
 * Rolls attack/defend, applies summed damage to the matching units in
 * `living` in place, and pushes attack/defend events. Returns the set of
 * engaged unit ids (adjacent to ≥1 enemy).
 */
function resolveCombat(
  living: GridUnit[],
  combatPool: GridUnit[],
  opts: StepTurnOptions,
  rng: () => number,
  events: TurnEvent[],
  // Units that moved this turn -- their defence roll takes MOVED_DEFENSE_PENALTY.
  movedIds: Set<string> = new Set(),
  // Per-unit attack order: an enemy id to attack exactly that unit, 'none' to
  // hold/defend without attacking, or 'auto' (the default for any unit not
  // listed) to pick a target automatically. Manual brawl units are given an
  // explicit id or 'none'; everything else is 'auto'.
  attackIntent?: Map<string, string>
): { engagedIds: Set<string> } {
  const attackerPctBonus = opts.attackerPctBonus ?? 0;
  const attackerFlatBonus = opts.attackerFlatBonus ?? 0;
  const defenderFlatBonus = opts.defenderFlatBonus ?? 0;
  const defenderAbsorbBonus = opts.defenderAbsorbBonus ?? 0;

  const adjacency = new Map<string, GridUnit[]>();
  for (const u of combatPool) adjacency.set(u.id, livingAdjacentEnemies(u, combatPool));

  const attackerCount = (u: GridUnit) => adjacency.get(u.id)?.length ?? 0;
  const engaged = combatPool.filter((u) => attackerCount(u) >= 1);

  // Per-unit random key for the final target tiebreak, stable within this batch.
  const rand = new Map<string, number>();
  for (const u of combatPool) rand.set(u.id, rng());

  const intentOf = (u: GridUnit): string => attackIntent?.get(u.id) ?? 'auto';

  // Each engaged unit's chosen target. 'auto' picks the best adjacent enemy —
  //   1) the weakest (least HP), 2) the one the most friendly units are
  //   adjacent to (converging fire), 3) a random one. An explicit id attacks
  //   exactly that enemy if it's still adjacent; 'none' (or a stale id) means
  //   the unit doesn't attack and will defend if it's under fire.
  const bestAdjacent = (u: GridUnit): GridUnit | undefined =>
    [...adjacency.get(u.id)!].sort(
      (a, b) =>
        a.hp - b.hp ||
        attackerCount(b) - attackerCount(a) ||
        (rand.get(a.id) ?? 0) - (rand.get(b.id) ?? 0)
    )[0];

  const chosenTarget = new Map<string, GridUnit | undefined>();
  for (const u of engaged) {
    const it = intentOf(u);
    if (it === 'none') chosenTarget.set(u.id, undefined);
    else if (it === 'auto') chosenTarget.set(u.id, bestAdjacent(u));
    else chosenTarget.set(u.id, adjacency.get(u.id)!.find((e) => e.id === it));
  }

  // Every engaged unit with a target attacks it, full stop.
  const willAttack = (u: GridUnit): boolean => !!chosenTarget.get(u.id);

  // Only whoever is swinging rolls damage now -- a defender's own stats no
  // longer decide what it stops, the absorption roll does. The flat bonus
  // still follows the unit's own side, so an ambushed player (who holds the
  // grid's defender role) still swings with their weapons' bonus.
  const attackRollFor = (u: GridUnit): number => {
    const sidePct = u.side === 'attacker' ? attackerPctBonus : 0;
    const sideFlat = u.side === 'attacker' ? attackerFlatBonus : defenderFlatBonus;
    return rollDamage(u, sidePct, sideFlat, rng);
  };

  // The defender's second-stage bonus: its side's standing bonus (a
  // garrison's tile level -- see Tile.getGarrisonAbsorbBonus), less a point
  // if it moved this turn and never set its footing.
  const absorbBonusFor = (u: GridUnit): number =>
    (u.side === 'defender' ? defenderAbsorbBonus : 0) -
    (movedIds.has(u.id) ? MOVED_DEFENSE_PENALTY : 0);

  const damage = new Map<string, number>();
  const applyDamage = (unitId: string, amount: number) => {
    if (amount <= 0) return;
    damage.set(unitId, (damage.get(unitId) ?? 0) + amount);
  };

  // Each attack is soaked by its own fresh absorption roll, rather than one
  // roll spread over the summed incoming -- being swarmed should hurt, but
  // every attacker after the first meets a progressively weaker guard
  // rather than a free pass through one already-spent roll.
  const incomingBy = new Map<string, GridUnit[]>();
  for (const u of engaged) {
    if (!willAttack(u)) continue;
    const target = chosenTarget.get(u.id)!;
    const list = incomingBy.get(target.id);
    if (list) list.push(u);
    else incomingBy.set(target.id, [u]);
  }

  // How much of the share it rolled a target actually brings to bear
  // against its i-th attacker this turn (1-based): all of it against the
  // first, then 80%, 70%, ... A hex cell has at most 6 neighbours, so this
  // bottoms out at 40%; floored at 0 regardless.
  const defenceFactor = (i: number): number => (i <= 1 ? 1 : Math.max(0, (100 - i * 10) / 100));

  for (const u of engaged) {
    // Attackers are taken in a random order, so no unit is permanently the
    // one that meets the target at full strength.
    const attackers = (incomingBy.get(u.id) ?? []).sort(
      (a, b) => (rand.get(a.id) ?? 0) - (rand.get(b.id) ?? 0)
    );
    let total = 0;
    let absorbedTotal = 0;
    let critical = false;
    const wasWounded = u.hp < u.maxHp;
    attackers.forEach((atk, idx) => {
      let roll = attackRollFor(atk);
      // A spent attacker still swings, just much weaker.
      if (atk.energy === 0) {
        roll = Math.round(roll * ENERGY_DEPLETED_DAMAGE_MULT);
      }

      atk.energy = Math.max(0, atk.energy - 1);
      const absorbed = rollAbsorption(absorbBonusFor(u), rng) * defenceFactor(idx + 1);
      // A partial soak always lets a point through, however feeble the
      // swing -- only an outright block (a first-stage 6, which survives
      // the swarm factor only for the first attacker) stops it dead. This
      // floor is what guarantees a fight can always resolve.
      const hit = roll <= 0 || absorbed >= 1 ? 0 : Math.max(1, Math.floor(roll * (1 - absorbed)));
      absorbedTotal += roll - hit;
      total += hit;
      // Only a landed hit (not fully blocked) against an already-wounded
      // target can crit -- a full-health unit, or a fully-soaked attack,
      // never triggers one.
      const fromBehind = isFromBehind(atk, u);
      const critChance = CRITICAL_HIT_CHANCE * (fromBehind ? BEHIND_CRIT_MULT : 1);
      const isCritical = hit > 0 && wasWounded && !critical && rng() < critChance;
      if (isCritical) critical = true;
      events.push({
        type: 'attack',
        unitId: atk.id,
        side: atk.side,
        kind: atk.kind,
        targetId: u.id,
        roll,
        damage: roll,
        ...(isCritical ? { critical: true } : {}),
        ...(fromBehind ? { fromBehind: true } : {}),
      });
    });
    // Every engaged unit shows as defending, attacking or not -- an unattacked
    // one just has nothing to soak. `roll` carries the damage actually
    // soaked, which is the readable stand-in now that there's no guard roll.
    events.push({ type: 'defend', unitId: u.id, side: u.side, kind: u.kind, roll: absorbedTotal });
    if (attackers.length === 0) continue;
    // A critical hit kills regardless of remaining HP -- bump total up to at
    // least the target's current HP so the hp-= below always zeroes it out.
    applyDamage(u.id, critical ? Math.max(total, u.hp) : total);
    // Soaked the whole volley -- purely cosmetic (see TurnEventType), flashes
    // 🛡️ on it in the battle replay.
    if (total === 0) {
      events.push({ type: 'block', unitId: u.id, side: u.side, kind: u.kind });
    }
  }

  for (const [unitId, amount] of Array.from(damage)) {
    const unit = living.find((u) => u.id === unitId);
    if (unit) unit.hp -= amount;
  }

  return { engagedIds: new Set(engaged.map((u) => u.id)) };
}

/** One side's planned brawl move: a destination cell per living unit of that
 * side. A destination equal to the unit's current cell means "stay and fight"
 * (it's adjacent to an enemy, or boxed in). */
export interface BrawlPlan {
  [unitId: string]: { col: number; row: number };
}

/**
 * Auto-plan one side's brawl move turn with the same primitives as the full
 * battle: a unit already adjacent to an enemy stays put to fight; every other
 * unit steps one cell toward its nearest enemy. Destinations are claimed in
 * closest-to-enemy-first order and every unit's current cell starts blocked,
 * so no two units ever plan onto the same cell (collision-free by
 * construction — important on the small brawl board).
 */
export function planBrawlSide(
  state: GridBattleState,
  side: BattleSide,
  rng: () => number = Math.random
): BrawlPlan {
  const living = state.units.filter((u) => u.hp > 0);
  const sideUnits = living.filter((u) => u.side === side);

  const tiebreak = new Map<string, number>();
  for (const u of sideUnits) tiebreak.set(u.id, rng());
  const order = [...sideUnits].sort(
    (a, b) => nearestEnemyDistance(a, living) - nearestEnemyDistance(b, living) || tiebreak.get(a.id)! - tiebreak.get(b.id)!
  );

  // Every occupied cell is blocked up front (both sides), so movers only ever
  // step into a cell that was empty at the start of this side's turn.
  // Obstacle cells are blocked the same way, permanently.
  const terrain = obstacleKeySet(state);
  const blocked = new Set(terrain);
  for (const u of living) blocked.add(`${u.col},${u.row}`);

  const plan: BrawlPlan = {};
  for (const u of order) {
    // Already claimed as another wounded unit's swap reserve this turn --
    // that claim stands in for its own plan entirely, no independent move.
    if (plan[u.id]) continue;
    if (livingAdjacentEnemies(u, living).length >= 1) {
      // The last unit standing on its side never swaps out or pulls back
      // (see isLastAlive) -- nothing left to protect by doing so, so it
      // falls straight through to "stay and fight" below regardless of HP.
      if (u.hp <= u.maxHp / 2 && !isLastAlive(u, living)) {
        const friends = livingAdjacentFriends(u, living);
        // Swap: trade places with an adjacent ally that isn't itself in
        // contact (a fresh reserve, not busy fighting) AND is actually
        // healthier than it (strictly more HP, and above half its own max)
        // -- otherwise two similarly-wounded units could swap back and forth
        // forever without ever resolving anything. The wounded unit steps
        // back, the reserve steps up, both in the same beat. Always valid:
        // each vacates exactly the cell the other enters, so neither needs
        // pathfinding or a blocked-set update. Not capped by safetyMoves --
        // unlike a solo pullback, someone (the reserve) is always taking on
        // the risk in exchange, not avoiding it for free. A unit that just
        // swapped sits the next round out (swapCooldown), so a pair can't
        // trade places every round instead of ever fighting.
        const reserve =
          u.swapCooldown > 0
            ? undefined
            : friends.find(
                (f) =>
                  !plan[f.id] &&
                  f.swapCooldown === 0 &&
                  livingAdjacentEnemies(f, living).length === 0 &&
                  f.hp > u.hp &&
                  f.hp > f.maxHp / 2
              );
        if (reserve) {
          plan[u.id] = { col: reserve.col, row: reserve.row };
          plan[reserve.id] = { col: u.col, row: u.row };
          continue;
        }

        // No ally to swap with -- pull back alone, but only when truly
        // alone (any ally at all, even a busy one, means safety in numbers:
        // stay and fight instead). Capped 2 in a row via retreatStreak.
        if (friends.length === 0 && u.safetyMoves < SAFETY_MOVE_CAP) {
          const safe = safeAdjacentCell(u, living, state.cols, state.rows, blocked);
          if (safe) {
            blocked.delete(`${u.col},${u.row}`);
            blocked.add(`${safe.col},${safe.row}`);
            plan[u.id] = safe;
            continue;
          }
        }
      }

      plan[u.id] = { col: u.col, row: u.row }; // adjacent: stay and fight
      continue;
    }

    const target = nearestLivingEnemy(u, living);
    const dest = target ? firstStepToward(u, target, state.cols, state.rows, blocked, terrain) : undefined;
    if (dest) {
      // free the origin, claim the destination
      blocked.delete(`${u.col},${u.row}`);
      blocked.add(`${dest.col},${dest.row}`);
      plan[u.id] = dest;
    } else {
      plan[u.id] = { col: u.col, row: u.row }; // boxed in: stay
    }
  }

  return plan;
}

/** Apply a side's planned brawl moves to positions (pure — no combat, no turn
 * bump). Units not in the plan keep their cell. A unit that broke contact to a
 * safe cell has its retreatStreak bumped (else reset) so the wounded-pullback
 * rule can cap consecutive retreats. */
export function applyBrawlMoves(state: GridBattleState, plan: BrawlPlan): GridBattleState {
  const adjEnemy = (col: number, row: number, side: BattleSide) =>
    state.units.some((v) => v.hp > 0 && v.side !== side && hexDistance({ col, row }, v) === 1);
  // A swap is exactly a pair trading cells: each one's destination is the
  // other's current cell. Set to 2, not 1, because resolveBrawlCombat ticks
  // every cooldown down once at the end of this same round -- leaving 1,
  // which blocks the next round, then clears.
  const at = new Map(state.units.filter((u) => u.hp > 0).map((u) => [`${u.col},${u.row}`, u]));
  const swapped = new Set<string>();
  for (const u of state.units) {
    const dest = plan[u.id];
    if (!dest) continue;
    const other = at.get(`${dest.col},${dest.row}`);
    const otherDest = other && other.id !== u.id ? plan[other.id] : undefined;
    if (otherDest && otherDest.col === u.col && otherDest.row === u.row) swapped.add(u.id);
  }

  const units = state.units.map((u) => {
    const dest = plan[u.id];
    if (!dest) return { ...u };
    const movedAway = dest.col !== u.col || dest.row !== u.row;
    const pulledBack = movedAway && adjEnemy(u.col, u.row, u.side) && !adjEnemy(dest.col, dest.row, u.side);
    return {
      ...u,
      col: dest.col,
      row: dest.row,
      safetyMoves: pulledBack ? u.safetyMoves + 1 : u.safetyMoves,
      swapCooldown: swapped.has(u.id) ? 2 : u.swapCooldown,
    };
  });
  return { ...state, units };
}

/**
 * Resolve a brawl round's combat: one all-at-once batch over everyone at their
 * current (post-move) positions, then remove
 * the dead and bump the turn. This is the "damage calculation phase" after
 * both sides have moved.
 */
export function resolveBrawlCombat(
  state: GridBattleState,
  opts: StepTurnOptions = {},
  movedIds: Set<string> = new Set(),
  attackIntent?: Map<string, string>
): TurnResult {
  const rng = opts.rng ?? Math.random;
  const events: TurnEvent[] = [];
  if (isBattleOver(state)) return { state, events };

  const living = state.units.map((u) => ({ ...u }));
  resolveCombat(living, living, opts, rng, events, movedIds, attackIntent);

  const dead = living.filter((u) => u.hp <= 0);
  for (const u of dead) events.push({ type: 'death', unitId: u.id, side: u.side, kind: u.kind });
  const alive = living.filter((u) => u.hp > 0);

  // End of round: tick every swap cooldown down one (see applyBrawlMoves),
  // and fully restore a truly idle unit's energy (didn't move, didn't attack).
  const attackedIds = new Set(events.filter((e) => e.type === 'attack').map((e) => e.unitId));
  for (const u of alive) {
    if (u.swapCooldown > 0) u.swapCooldown -= 1;
    if (!movedIds.has(u.id) && !attackedIds.has(u.id)) u.energy = energyFor(u.kind);
  }

  const status = battleStatus(alive, state.reserves);
  return { state: { ...state, units: alive, turn: state.turn + 1, status }, events };
}

// A real battle always ends well before this, on either path -- just a
// backstop against an unresolvable stalemate looping forever.
const MAX_ROUNDS = 300;

/**
 * Run a battle straight to its outcome -- the same round BattleScreen plays
 * (reinforcements, defender moves, attacker moves, combat) with no animation
 * and no intermediate state kept. Shared by the battle simulator and the
 * headless economy simulator so "what a battle of these exact parameters
 * resolves to" is decided in exactly one place.
 */
export function runGridBattleToCompletion(
  initialState: GridBattleState,
  opts: StepTurnOptions = {},
  rng: () => number = Math.random
): GridBattleState {
  let state = initialState;
  let rounds = 0;
  while (!isBattleOver(state) && rounds < MAX_ROUNDS) {
    rounds++;
    state = deployReinforcements(state);
    const startPos = new Map(state.units.map((u) => [u.id, { col: u.col, row: u.row }]));
    const defMoved = applyBrawlMoves(state, planBrawlSide(state, 'defender', rng));
    const atkMoved = applyBrawlMoves(defMoved, planBrawlSide(defMoved, 'attacker', rng));
    const movedIds = new Set<string>();
    for (const u of atkMoved.units) {
      const p = startPos.get(u.id);
      if (!p || p.col !== u.col || p.row !== u.row) movedIds.add(u.id);
    }

    state = resolveBrawlCombat(atkMoved, { rng, ...opts }, movedIds, undefined).state;
  }

  return state;
}
