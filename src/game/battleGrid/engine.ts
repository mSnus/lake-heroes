import { rollInRange } from '../Dice';
import {
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  DRAGON_HP,
  DRAGON_DMG_MIN,
  DRAGON_DMG_MAX,
} from '../constants';
import { getOverrides } from '../../utils/overridesStore';
import { placeArmy } from './placement';
import { FormationSpec, placeFormation } from './formations';
import { BattleSide, GridBattleState, GridUnit, StepTurnOptions, TurnEvent, TurnResult, UnitKind } from './types';

interface Cell {
  col: number;
  row: number;
}

// The battlefield's even rows are rendered pushed half a cell to the right
// (see BattlefieldGrid.css) — a real "even-r" offset grid, not just a
// cosmetic shift: each cell has 6 neighbors, not 8, and distance is
// measured in hex steps, not Chebyshev steps. Converting to axial
// coordinates (q, r) — the standard way to reason about an offset hex
// grid — makes both distance and neighbor-finding straightforward instead
// of needing fiddly parity-based special cases everywhere they're used.
function toAxial(cell: Cell): { q: number; r: number } {
  return { q: cell.col - Math.floor((cell.row + 1) / 2), r: cell.row };
}

function hexDistance(a: Cell, b: Cell): number {
  const aa = toAxial(a);
  const ab = toAxial(b);
  const dq = aa.q - ab.q;
  const dr = aa.r - ab.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

// Real on-screen position (even rows shifted +0.5) — used only as a
// tie-break metric ("which of several equally-hex-close options is
// visually nearest"), since hex distance alone ties constantly.
function visualPos(cell: Cell): { x: number; y: number } {
  return { x: cell.col + (cell.row % 2 === 0 ? 0.5 : 0), y: cell.row };
}

// Each cell's 6 neighbors depend on row parity, since even rows sit half a
// cell to the right of odd rows — the two "diagonal" neighbors above and
// below are different cells depending on which side of the row you're on.
const NEIGHBOR_OFFSETS_EVEN_ROW: Cell[] = [
  { col: -1, row: 0 },
  { col: 1, row: 0 },
  { col: 0, row: -1 },
  { col: 1, row: -1 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
];
const NEIGHBOR_OFFSETS_ODD_ROW: Cell[] = [
  { col: -1, row: 0 },
  { col: 1, row: 0 },
  { col: -1, row: -1 },
  { col: 0, row: -1 },
  { col: -1, row: 1 },
  { col: 0, row: 1 },
];
function neighborOffsetsFor(row: number): Cell[] {
  return row % 2 === 0 ? NEIGHBOR_OFFSETS_EVEN_ROW : NEIGHBOR_OFFSETS_ODD_ROW;
}

/** In-bounds hex neighbours of a cell on the offset grid — the exact same
 * adjacency the engine uses, exported so the manual brawl overlay agrees on
 * which cells a unit may step to. */
export function adjacentCells(col: number, row: number, cols: number, rows: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  for (const off of neighborOffsetsFor(row)) {
    const c = col + off.col;
    const r = row + off.row;
    if (c >= 0 && c < cols && r >= 0 && r < rows) out.push({ col: c, row: r });
  }
  return out;
}

// A unit that's actively defending (mitigating incoming damage rather than
// dealing it) rolls with this bonus on top of whatever side bonuses
// (artifacts, garrison) already apply. Set to 0 (off) -- balance knob, adjust
// as needed.
const DEFENSE_ROLL_BONUS = 0;

// A unit that moved this turn defends less effectively -- it hasn't set its
// footing to brace for the hit.
const MOVED_DEFENSE_PENALTY = 0.1;

// Lifetime cap on wounded-pullback moves per unit — after this many total
// break-offs to safety, a wounded unit commits to fighting instead, which
// guarantees the battle can't stall in an endless pull-back/re-advance dance.
const SAFETY_MOVE_CAP = 3;

function hpFor(kind: UnitKind): number {
  const ov = getOverrides();
  if (kind === 'dragon') return DRAGON_HP;
  if (kind === 'zombie') return Math.round(ov.militiaHp * ov.zombieHpMult);
  return kind === 'rider' ? ov.riderHp : ov.militiaHp;
}

function rollDamage(kind: UnitKind, pctBonus: number, flatBonus: number, rng: () => number): number {
  const ov = getOverrides();
  // Zombies share militia's roll range, scaled by the zombie damage multiplier.
  const [min, max] =
    kind === 'dragon'
      ? [DRAGON_DMG_MIN, DRAGON_DMG_MAX]
      : kind === 'rider'
        ? [ov.riderDmgMin, ov.riderDmgMax]
        : [ov.militiaDmgMin, ov.militiaDmgMax];
  const mult = kind === 'zombie' ? ov.zombieDmgMult : 1;
  const base = rollInRange(min, max, rng) * mult;
  return Math.max(0, Math.round(base * (1 + pctBonus) + flatBonus));
}

/** Build a fresh battle, both armies placed on opposite long edges. With no
 * formation specified, riders fill the front rows (closest to the enemy)
 * and militia the back, in a square-ish block (see placement.ts). A side
 * with a `formation` uses one of the shaped layouts instead — triangle
 * (ambushers), columns (caravan guards), or grouped (towers/squads) — see
 * formations.ts. */
export function createBattle(
  attacker: { militia: number; riders: number; formation?: FormationSpec; zombie?: boolean },
  defender: { militia: number; riders: number; formation?: FormationSpec; zombie?: boolean },
  cols: number = BATTLEFIELD_COLS,
  rows: number = BATTLEFIELD_ROWS
): GridBattleState {
  let stableIndex = 0;
  const units: GridUnit[] = [];

  // Militia fill first (placeArmy fills columns outward from the edge, so
  // earlier-pushed units land in the back rows) and riders fill last, so
  // riders end up in the front rows — closest to the enemy.
  const buildSide = (side: BattleSide, comp: { militia: number; riders: number; formation?: FormationSpec; zombie?: boolean }) => {
    const sideUnits: GridUnit[] = [];
    // The dragon fight's defender is its own unit kind (own HP/damage), not
    // a rider — its full DRAGON_UNITS headcount arrives via `riders` (see
    // BattleScreen.tsx's composition for isDragon), militia always 0.
    const isDragonSide = comp.formation?.kind === 'dragon';
    // An abandoned tile's wild garrison guards as Zombies instead of regular
    // militia (see BattleScreen.tsx's `zombie: !!tile?.abandoned`).
    const militiaKind: UnitKind = comp.zombie ? 'zombie' : 'militia';
    for (let i = 0; i < comp.militia; i++) {
      sideUnits.push({
        id: `${side}-${stableIndex}`,
        side,
        kind: militiaKind,
        hp: hpFor(militiaKind),
        maxHp: hpFor(militiaKind),
        col: 0,
        row: 0,
        stableIndex: stableIndex++,
        retreatStreak: 0,
        safetyMoves: 0,
      });
    }
    for (let i = 0; i < comp.riders; i++) {
      const kind: UnitKind = isDragonSide ? 'dragon' : 'rider';
      sideUnits.push({
        id: `${side}-${stableIndex}`,
        side,
        kind,
        hp: hpFor(kind),
        maxHp: hpFor(kind),
        col: 0,
        row: 0,
        stableIndex: stableIndex++,
        retreatStreak: 0,
        safetyMoves: 0,
      });
    }
    if (comp.formation && comp.formation.kind !== 'square') {
      placeFormation(sideUnits, side, cols, rows, comp.formation, comp.militia, comp.riders);
    } else {
      placeArmy(sideUnits, side, cols, rows);
    }
    units.push(...sideUnits);
  };

  buildSide('attacker', attacker);
  buildSide('defender', defender);

  return { cols, rows, units, turn: 0, status: 'ongoing' };
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
function firstStepToward(start: Cell, target: Cell, cols: number, rows: number, blocked: Set<string>): Cell | undefined {
  const targetKey = `${target.col},${target.row}`;
  const visited = new Set<string>([`${start.col},${start.row}`, targetKey]);

  let bestFirstStep: Cell | undefined;
  let bestDist = hexDistance(start, target);
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
    const d = hexDistance(c, target);
    if (d === 1) return firstStep;
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

// Whether `u` has at least one in-bounds neighbor cell not already occupied
// by another living unit — a cheap, static (pre-movement-planning) check for
// "is retreat even physically possible", using turn-start positions. The
// real destination (and whether it's actually still free once other movers
// have claimed cells) is worked out later, same as any other mover; this
// only gates whether a surrounded unit should attempt to flee at all instead
// of fighting.
function hasOpenAdjacentCell(u: GridUnit, living: GridUnit[], cols: number, rows: number): boolean {
  const occupied = new Set(living.filter((v) => v.id !== u.id).map((v) => `${v.col},${v.row}`));
  for (const off of neighborOffsetsFor(u.row)) {
    const c = { col: u.col + off.col, row: u.row + off.row };
    if (c.col < 0 || c.col >= cols || c.row < 0 || c.row >= rows) continue;
    if (!occupied.has(`${c.col},${c.row}`)) return true;
  }
  return false;
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

// Single-step "step aside" for a retreating unit with no living friend to
// flee toward: just the one in-bounds, unblocked neighbor that puts the most
// hex distance between the unit and whoever it's fleeing — no BFS, since
// retreat is a one-hex sidestep, not a route to a far-off destination.
function firstStepAwayFrom(start: Cell, awayFrom: Cell, cols: number, rows: number, blocked: Set<string>): Cell | undefined {
  let best: Cell | undefined;
  let bestDist = hexDistance(start, awayFrom);
  let bestEuclidSq = -Infinity;
  const awayPos = visualPos(awayFrom);
  for (const off of neighborOffsetsFor(start.row)) {
    const c = { col: start.col + off.col, row: start.row + off.row };
    if (c.col < 0 || c.col >= cols || c.row < 0 || c.row >= rows) continue;
    const key = `${c.col},${c.row}`;
    if (blocked.has(key)) continue;
    const d = hexDistance(c, awayFrom);
    const cPos = visualPos(c);
    const dx = cPos.x - awayPos.x;
    const dy = cPos.y - awayPos.y;
    const euclidSq = dx * dx + dy * dy;
    const better = d > bestDist || (d === bestDist && euclidSq > bestEuclidSq);
    if (better) {
      bestDist = d;
      bestEuclidSq = euclidSq;
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

// Same nearest-with-visual-tiebreak pattern as nearestLivingEnemy, flipped to
// find the closest living ally instead — used to steer a retreating unit
// toward safety rather than away from nothing in particular.
function nearestLivingFriend(u: GridUnit, living: GridUnit[]): GridUnit | undefined {
  let best: GridUnit | undefined;
  let bestHex = Infinity;
  let bestEuclidSq = Infinity;
  const uPos = visualPos(u);
  for (const v of living) {
    if (v.id === u.id || v.side !== u.side) continue;
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
 * One all-at-once combat batch over `combatPool` (a subset of `living` — the
 * full battle excludes this turn's retreaters; a brawl passes everyone).
 * Rolls attack/defend, applies summed damage to the matching units in
 * `living` in place, and pushes attack/defend events. Returns the set of
 * engaged unit ids (adjacent to ≥1 enemy) so the caller can tell movers from
 * fighters. Shared by stepTurn (full battle) and resolveBrawlCombat so the
 * two never drift apart.
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
  const defenderPctBonus = opts.defenderPctBonus ?? 0;
  const defenderFlatBonus = opts.defenderFlatBonus ?? 0;

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

  const rollFor = (u: GridUnit, defending: boolean): number => {
    const sidePct = u.side === 'attacker' ? attackerPctBonus : defenderPctBonus;
    const sideFlat = u.side === 'attacker' ? attackerFlatBonus : defenderFlatBonus;
    const movedPenalty = defending && movedIds.has(u.id) ? MOVED_DEFENSE_PENALTY : 0;
    const pct = (defending ? sidePct + DEFENSE_ROLL_BONUS : sidePct) - movedPenalty;
    return rollDamage(u.kind, pct, sideFlat, rng);
  };

  const damage = new Map<string, number>();
  const applyDamage = (unitId: string, amount: number) => {
    if (amount <= 0) return;
    damage.set(unitId, (damage.get(unitId) ?? 0) + amount);
  };

  const incoming = new Map<string, number>();
  const defenceRoll = new Map<string, number>();

  // Every engaged unit rolls a defence value, attacking or not.
  for (const u of engaged) defenceRoll.set(u.id, rollFor(u, true));

  for (const u of engaged) {
    if (!willAttack(u)) continue;
    const target = chosenTarget.get(u.id)!;
    const roll = rollFor(u, false);
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + roll);
    events.push({ type: 'attack', unitId: u.id, side: u.side, kind: u.kind, targetId: target.id, roll, damage: roll });
  }

  for (const u of engaged) {
    const roll = defenceRoll.get(u.id);
    if (roll === undefined) continue;
    events.push({ type: 'defend', unitId: u.id, side: u.side, kind: u.kind, roll });
  }

  for (const u of engaged) {
    const inc = incoming.get(u.id);
    if (!inc) continue;
    const net = defenceRoll.has(u.id) ? Math.max(0, inc - defenceRoll.get(u.id)!) : inc;
    applyDamage(u.id, net);
    // A held unit whose defence roll fully absorbed the hit -- purely
    // cosmetic (see TurnEventType), flashes 🛡️ on it in the battle replay.
    if (net === 0 && defenceRoll.has(u.id)) {
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
  const blocked = new Set<string>();
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
        // contact (a fresh reserve, not busy fighting) -- the wounded unit
        // steps back, the reserve steps up, both in the same beat. Always
        // valid: each vacates exactly the cell the other enters, so neither
        // needs pathfinding or a blocked-set update. Not capped by
        // safetyMoves -- unlike a solo pullback, someone (the reserve) is
        // always taking on the risk in exchange, not avoiding it for free.
        const reserve = friends.find(
          (f) => !plan[f.id] && livingAdjacentEnemies(f, living).length === 0
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
    const dest = target ? firstStepToward(u, target, state.cols, state.rows, blocked) : undefined;
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
  const units = state.units.map((u) => {
    const dest = plan[u.id];
    if (!dest) return { ...u };
    const movedAway = dest.col !== u.col || dest.row !== u.row;
    const pulledBack = movedAway && adjEnemy(u.col, u.row, u.side) && !adjEnemy(dest.col, dest.row, u.side);
    return { ...u, col: dest.col, row: dest.row, safetyMoves: pulledBack ? u.safetyMoves + 1 : u.safetyMoves };
  });
  return { ...state, units };
}

/**
 * Resolve a brawl round's combat: one all-at-once batch over everyone at their
 * current (post-move) positions — same math as the full battle — then remove
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

  const attackerAlive = alive.some((u) => u.side === 'attacker');
  const defenderAlive = alive.some((u) => u.side === 'defender');
  const status: GridBattleState['status'] =
    !attackerAlive && !defenderAlive ? 'tie' : !defenderAlive ? 'attacker-win' : !attackerAlive ? 'defender-win' : 'ongoing';

  return { state: { ...state, units: alive, turn: state.turn + 1, status }, events };
}

/**
 * Resolve one turn: an all-at-once combat batch against turn-start positions
 * (threat-score target selection needs a stable snapshot), followed by a
 * movement phase for non-engaged units (plus any retreating unit — see
 * below) only. Movement is planned against a shadow map before any unit
 * actually moves — a mover's current cell is never an obstacle for another
 * mover planning its own step, since it's assumed to vacate this turn
 * regardless of priority order — then all planned moves are applied
 * together (see the movement section below).
 */
export function stepTurn(state: GridBattleState, opts: StepTurnOptions = {}): TurnResult {
  const rng = opts.rng ?? Math.random;
  const events: TurnEvent[] = [];

  if (isBattleOver(state)) return { state, events };

  const living = state.units.map((u) => ({ ...u }));

  // ── Step 1: turn order — closest-to-enemy units decide first (both for
  // combat targeting below and for movement planning further down), so
  // that by the time a farther-back unit plans its move, every unit
  // between it and the front has already committed to moving or staying.
  // Ties (equal distance) are broken by a random draw assigned once per
  // unit this turn, not creation order — a fixed tiebreak doesn't matter
  // for combat, but for movement it can bias two spatially-equivalent
  // units into a bad relative order it can't shuffle out of.
  const tiebreak = new Map<string, number>();
  for (const u of living) tiebreak.set(u.id, rng());
  const priorityOrder = [...living].sort((a, b) => {
    const da = nearestEnemyDistance(a, living);
    const db = nearestEnemyDistance(b, living);
    return da - db || tiebreak.get(a.id)! - tiebreak.get(b.id)!;
  });

  // ── Step 2: retreat — a unit swarmed by 3+ adjacent enemies with no
  // adjacent friend to lean on, and with somewhere to go, breaks off instead
  // of fighting this turn. It's pulled out of the combat pool entirely below
  // (can't attack, can't be attacked, no defence roll — it's focused on
  // getting out) and handled as a mover in the movement phase instead,
  // heading toward its nearest living friend if it has one, or just away
  // from whoever it's fleeing if it doesn't. Capped at 2 retreats in a row
  // (retreatStreak) — a unit that's already ducked out twice is forced to
  // fight on its third otherwise-qualifying turn, rather than kiting
  // indefinitely. The last unit standing on its side never qualifies (see
  // isLastAlive) -- it has nothing left to fall back on, so it fights.
  const retreating = new Set<string>();
  for (const u of living) {
    if (isLastAlive(u, living)) continue;
    if (livingAdjacentEnemies(u, living).length < 3) continue;
    if (livingAdjacentFriends(u, living).length > 0) continue;
    if (u.retreatStreak >= 2) continue;
    if (!hasOpenAdjacentCell(u, living, state.cols, state.rows)) continue;
    retreating.add(u.id);
  }

  // ── Step 2b: wounded pullback — a hurt unit in contact with the enemy,
  // with NO friend beside it to hold the line for it and a safe cell (out of
  // enemy reach) to step into, pulls back to that cell instead of fighting
  // on alone. A friend adjacent means it stays and fights regardless of how
  // wounded it is — safety in numbers, no need to retreat. Same 2-in-a-row
  // cap as retreat, and it sits combat out this turn (it's moving, not
  // fighting). The last unit standing never pulls back either -- see
  // isLastAlive. ──
  const seekingSafety = new Set<string>();
  for (const u of living) {
    if (retreating.has(u.id)) continue;
    if (isLastAlive(u, living)) continue;
    if (u.hp > u.maxHp / 2) continue; // only pull back when at half HP or less
    if (livingAdjacentEnemies(u, living).length < 1) continue; // not in contact
    if (livingAdjacentFriends(u, living).length > 0) continue; // has a friend beside it — stays and fights
    if (u.safetyMoves >= SAFETY_MOVE_CAP) continue; // used up its pullbacks
    if (!safeAdjacentCell(u, living, state.cols, state.rows, new Set())) continue; // nowhere safe
    seekingSafety.add(u.id);
  }

  // ── Step 2c: swap — a wounded unit in contact with the enemy, with an
  // adjacent friend that ISN'T itself in contact (a fresh reserve, not busy
  // fighting), trades places with it instead of fighting on or pulling back
  // alone: the wounded unit steps back into the reserve's cell, the reserve
  // steps forward into the wounded unit's. The reserve gets no independent
  // plan of its own this turn — the wounded unit initiating the swap claims
  // it outright. Both sit combat out (mid-swap, not fighting) and skip the
  // normal destination pathfinding entirely below: the swap is always valid
  // by construction, each vacating exactly the cell the other enters. ──
  const swapPartner = new Map<string, GridUnit>();
  for (const u of living) {
    if (retreating.has(u.id) || seekingSafety.has(u.id)) continue;
    if (swapPartner.has(u.id)) continue; // already claimed as someone else's reserve
    if (u.hp > u.maxHp / 2) continue;
    if (livingAdjacentEnemies(u, living).length < 1) continue; // not in contact
    const reserve = livingAdjacentFriends(u, living).find(
      (f) => !swapPartner.has(f.id) && livingAdjacentEnemies(f, living).length === 0
    );
    if (!reserve) continue;
    swapPartner.set(u.id, reserve);
    swapPartner.set(reserve.id, u);
  }

  // ── Step 3: combat, over every unit except this turn's retreaters / pullback
  // / swapping units (who sit combat out) — shared with the brawl resolver, see
  // resolveCombat above. engagedIds (units adjacent to ≥1 enemy) is what tells
  // fighters from movers in the movement phase below. ──
  const combatPool = living.filter(
    (u) => !retreating.has(u.id) && !seekingSafety.has(u.id) && !swapPartner.has(u.id)
  );
  const { engagedIds } = resolveCombat(living, combatPool, opts, rng, events);

  // ── Apply combat damage, remove the dead ── (resolveCombat mutated hp)
  const dead = living.filter((u) => u.hp <= 0);
  for (const u of dead) events.push({ type: 'death', unitId: u.id, side: u.side, kind: u.kind });
  let alive = living.filter((u) => u.hp > 0);

  // ── Steps 4/5: movement, non-engaged units plus this turn's retreaters,
  // planned against a "shadow map" rather than executed sequentially. A
  // cell is only ever a real obstacle if a unit guaranteed to stay put
  // occupies it — a mover's own current cell is never treated as blocking
  // *up front*, since it's assumed to vacate this turn, regardless of where
  // in priority order it sits relative to whoever wants to step into it.
  // Destinations are claimed in priority order (closest-to-enemy first, see
  // Step 1) so two movers can't both plan into the same free cell, and if a
  // mover turns out unable to move after all (fully boxed in), its own cell
  // gets added to `blocked` at that point too — so any lower-priority mover
  // still to be planned this round correctly treats it as occupied instead
  // of planning a step into a cell that, in the end, was never vacated.
  const movers = priorityOrder.filter((u) => !engagedIds.has(u.id) && alive.some((a) => a.id === u.id));
  const moverIds = new Set(movers.map((m) => m.id));

  const staticOccupancy = new Map<string, string>(); // cells held by units that never move this turn
  for (const u of alive) {
    if (!moverIds.has(u.id)) staticOccupancy.set(`${u.col},${u.row}`, u.id);
  }
  // A swap pair's two cells are spoken for by the other half of the pair
  // the instant either vacates -- never actually free for a third unit to
  // path into, even though both members are technically movers.
  for (const id of Array.from(swapPartner.keys())) {
    const u = alive.find((a) => a.id === id);
    if (u) staticOccupancy.set(`${u.col},${u.row}`, u.id);
  }

  // Plan every mover's first step against a given obstacle set, in
  // priority order — a mover with no destination is "stuck" (its cell
  // wasn't vacated after all); its own cell is blocked immediately so
  // later movers in *this same round* don't plan into it. A retreating
  // unit heads toward its nearest living friend rather than its nearest
  // enemy; with no friend anywhere on the field it just sidesteps once,
  // away from whoever it's fleeing.
  const planMoves = (
    initialBlocked: Set<string>
  ): { plannedMove: Map<string, Cell>; stuck: Set<string> } => {
    const blocked = new Set(initialBlocked);
    const plannedMove = new Map<string, Cell>();
    const stuck = new Set<string>();
    for (const mover of movers) {
      const unit = alive.find((u) => u.id === mover.id)!;

      let dest: Cell | undefined;
      if (swapPartner.has(unit.id)) {
        // Fixed by the swap itself, not pathfound -- the partner's current
        // (pre-move) cell, which it's guaranteed to vacate this same beat.
        const partner = swapPartner.get(unit.id)!;
        dest = { col: partner.col, row: partner.row };
      } else if (seekingSafety.has(unit.id)) {
        dest = safeAdjacentCell(unit, alive, state.cols, state.rows, blocked);
      } else if (retreating.has(unit.id)) {
        const friend = nearestLivingFriend(unit, alive);
        const enemy = nearestLivingEnemy(unit, alive);
        dest = friend
          ? firstStepToward(unit, friend, state.cols, state.rows, blocked)
          : enemy
            ? firstStepAwayFrom(unit, enemy, state.cols, state.rows, blocked)
            : undefined;
      } else {
        const target = nearestLivingEnemy(unit, alive);
        if (!target) continue;
        dest = firstStepToward(unit, target, state.cols, state.rows, blocked);
      }

      if (dest) {
        blocked.add(`${dest.col},${dest.row}`);
        plannedMove.set(unit.id, dest);
      } else {
        blocked.add(`${unit.col},${unit.row}`);
        stuck.add(unit.id);
      }
    }
    return { plannedMove, stuck };
  };

  // Fixed-point re-planning: each round re-plans everyone from scratch with
  // every stuck unit found *so far* — this round or any earlier one, unioned
  // in, never replaced — blocked from the very start. A full re-plan can
  // make an *individual* unit's destination change between rounds (an
  // earlier-priority mover can lose its previous cell to newly-added
  // blocking and pick a different one), so comparing this round's raw stuck
  // set to last round's isn't a valid fixed-point check on its own — two
  // different units could swap being stuck without the set size changing.
  // Accumulating (union) instead of replacing is what makes the blocked
  // input strictly grow round over round, which *is* monotonic and bounded
  // by `movers.length` distinct units — the real fixed point is the round
  // where every stuck unit found is already among the ones already blocked,
  // i.e. re-planning against the accumulated set reproduces no new stuck
  // unit at all.
  let stuckIds = new Set<string>();
  let plannedMove = new Map<string, Cell>();
  for (let round = 0; round <= movers.length; round++) {
    const roundBlocked = new Set(staticOccupancy.keys());
    for (const id of Array.from(stuckIds)) {
      const u = alive.find((a) => a.id === id)!;
      roundBlocked.add(`${u.col},${u.row}`);
    }
    const result = planMoves(roundBlocked);
    plannedMove = result.plannedMove;
    const newlyStuck = Array.from(result.stuck).filter((id) => !stuckIds.has(id));
    if (newlyStuck.length === 0) break;
    for (const id of Array.from(result.stuck)) stuckIds.add(id);
  }

  for (const mover of movers) {
    if (!plannedMove.has(mover.id)) {
      events.push({ type: 'skip', unitId: mover.id, side: mover.side, kind: mover.kind });
    }
  }

  for (const mover of movers) {
    const dest = plannedMove.get(mover.id);
    if (!dest) continue;
    const unit = alive.find((u) => u.id === mover.id)!;
    events.push({
      type: 'move',
      unitId: unit.id,
      side: unit.side,
      kind: unit.kind,
      from: { col: unit.col, row: unit.row },
      to: { col: dest.col, row: dest.row },
    });
    unit.col = dest.col;
    unit.row = dest.row;
  }

  // A unit's streak only continues if it actually retreated this turn (was
  // marked as retreating *and* found somewhere to go) — anything else
  // (fighting, moving normally, or being stuck with nowhere to flee) resets
  // it, so only genuinely consecutive retreats count toward the cap.
  for (const u of alive) {
    u.retreatStreak = retreating.has(u.id) && plannedMove.has(u.id) ? u.retreatStreak + 1 : 0;
    if (seekingSafety.has(u.id) && plannedMove.has(u.id)) u.safetyMoves += 1;
  }

  alive = alive.map((u) => u);
  const attackerAlive = alive.some((u) => u.side === 'attacker');
  const defenderAlive = alive.some((u) => u.side === 'defender');
  const status: GridBattleState['status'] =
    !attackerAlive && !defenderAlive ? 'tie' : !defenderAlive ? 'attacker-win' : !attackerAlive ? 'defender-win' : 'ongoing';

  return {
    state: { ...state, units: alive, turn: state.turn + 1, status },
    events,
  };
}
