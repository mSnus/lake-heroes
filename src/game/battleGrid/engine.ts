import { rollInRange } from '../Dice';
import {
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  MILITIA_HP,
  MILITIA_DMG_MIN,
  MILITIA_DMG_MAX,
  RIDER_HP,
  RIDER_DMG_MIN,
  RIDER_DMG_MAX,
  DRAGON_HP,
  DRAGON_DMG_MIN,
  DRAGON_DMG_MAX,
} from '../constants';
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

function hpFor(kind: UnitKind): number {
  if (kind === 'dragon') return DRAGON_HP;
  return kind === 'rider' ? RIDER_HP : MILITIA_HP;
}

function rollDamage(kind: UnitKind, pctBonus: number, flatBonus: number, rng: () => number): number {
  const [min, max] =
    kind === 'dragon'
      ? [DRAGON_DMG_MIN, DRAGON_DMG_MAX]
      : kind === 'rider'
        ? [RIDER_DMG_MIN, RIDER_DMG_MAX]
        : [MILITIA_DMG_MIN, MILITIA_DMG_MAX];
  const base = rollInRange(min, max, rng);
  return Math.max(0, Math.round(base * (1 + pctBonus) + flatBonus));
}

/** Build a fresh battle, both armies placed on opposite long edges. With no
 * formation specified, riders fill the front rows (closest to the enemy)
 * and militia the back, in a square-ish block (see placement.ts). A side
 * with a `formation` uses one of the shaped layouts instead — triangle
 * (ambushers), columns (caravan guards), or grouped (towers/squads) — see
 * formations.ts. */
export function createBattle(
  attacker: { militia: number; riders: number; formation?: FormationSpec },
  defender: { militia: number; riders: number; formation?: FormationSpec },
  cols: number = BATTLEFIELD_COLS,
  rows: number = BATTLEFIELD_ROWS
): GridBattleState {
  let stableIndex = 0;
  const units: GridUnit[] = [];

  // Militia fill first (placeArmy fills columns outward from the edge, so
  // earlier-pushed units land in the back rows) and riders fill last, so
  // riders end up in the front rows — closest to the enemy.
  const buildSide = (side: BattleSide, comp: { militia: number; riders: number; formation?: FormationSpec }) => {
    const sideUnits: GridUnit[] = [];
    // The dragon fight's defender is its own unit kind (own HP/damage), not
    // a rider — its full DRAGON_UNITS headcount arrives via `riders` (see
    // BattleScreen.tsx's composition for isDragon), militia always 0.
    const isDragonSide = comp.formation?.kind === 'dragon';
    for (let i = 0; i < comp.militia; i++) {
      sideUnits.push({
        id: `${side}-${stableIndex}`,
        side,
        kind: 'militia',
        hp: hpFor('militia'),
        maxHp: hpFor('militia'),
        col: 0,
        row: 0,
        stableIndex: stableIndex++,
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
 * Resolve one turn: an all-at-once combat batch against turn-start positions
 * (threat-score target selection needs a stable snapshot), followed by a
 * movement phase for non-engaged units only. Movement is planned against a
 * shadow map before any unit actually moves — a mover's current cell is
 * never an obstacle for another mover planning its own step, since it's
 * assumed to vacate this turn regardless of priority order — then all
 * planned moves are applied together (see the movement section below).
 */
export function stepTurn(state: GridBattleState, opts: StepTurnOptions = {}): TurnResult {
  const rng = opts.rng ?? Math.random;
  const attackerPctBonus = opts.attackerPctBonus ?? 0;
  const attackerFlatBonus = opts.attackerFlatBonus ?? 0;
  const defenderPctBonus = opts.defenderPctBonus ?? 0;
  const defenderFlatBonus = opts.defenderFlatBonus ?? 0;
  const events: TurnEvent[] = [];

  if (isBattleOver(state)) return { state, events };

  const living = state.units.map((u) => ({ ...u }));

  // ── Step 1: turn order — adjacent-to-enemy units rank first as a natural
  // consequence of sorting by nearest-enemy distance (dist 1 sorts lowest). ──
  const priorityOrder = [...living].sort((a, b) => {
    const da = nearestEnemyDistance(a, living);
    const db = nearestEnemyDistance(b, living);
    return da - db || a.stableIndex - b.stableIndex;
  });

  // ── Step 3: combat plan, computed once against the turn-start snapshot ──
  const adjacency = new Map<string, GridUnit[]>();
  for (const u of living) adjacency.set(u.id, livingAdjacentEnemies(u, living));

  const attackerCount = (u: GridUnit) => adjacency.get(u.id)!.length;
  const engaged = living.filter((u) => attackerCount(u) >= 1);

  // Every engaged unit picks the single adjacent enemy it values most —
  // whichever one has the most attackers converging on it (ties broken by
  // stableIndex) — so several attackers can independently converge fire on
  // the same juiciest target.
  const chosenTarget = new Map<string, GridUnit | undefined>();
  for (const u of engaged) {
    const opts2 = [...adjacency.get(u.id)!].sort(
      (a, b) => attackerCount(b) - attackerCount(a) || a.stableIndex - b.stableIndex
    );
    chosenTarget.set(u.id, opts2[0]);
  }

  // Who's actually gunning for each unit this turn (the inverse of
  // chosenTarget) — a unit under attack from 3 enemies has 3 entries here.
  const attackersOf = new Map<string, GridUnit[]>();
  for (const u of engaged) attackersOf.set(u.id, []);
  for (const u of engaged) {
    const target = chosenTarget.get(u.id);
    if (target) attackersOf.get(target.id)!.push(u);
  }

  // A unit under attack fights back (rather than defending) only if it's
  // itself targeting one of the units currently attacking it. Otherwise —
  // including a unit with no attackers at all, which simply attacks its own
  // chosen target unopposed — it rolls to attack normally.
  const isDefending = (u: GridUnit): boolean => {
    const attackers = attackersOf.get(u.id) ?? [];
    if (attackers.length === 0) return false;
    const target = chosenTarget.get(u.id);
    return !target || !attackers.some((a) => a.id === target.id);
  };

  const rollFor = (u: GridUnit): number =>
    u.side === 'attacker'
      ? rollDamage(u.kind, attackerPctBonus, attackerFlatBonus, rng)
      : rollDamage(u.kind, defenderPctBonus, defenderFlatBonus, rng);

  const damage = new Map<string, number>(); // unitId -> accumulated damage this turn
  const applyDamage = (unitId: string, amount: number) => {
    if (amount <= 0) return;
    damage.set(unitId, (damage.get(unitId) ?? 0) + amount);
  };

  // One roll per engaged unit, total — an attacking unit's roll is added to
  // its target's incoming damage; a defending unit's roll is saved to
  // mitigate the sum of everything converging on it below.
  const incoming = new Map<string, number>(); // targetId -> summed attacker rolls
  const defenceRoll = new Map<string, number>();

  for (const u of engaged) {
    if (isDefending(u)) {
      defenceRoll.set(u.id, rollFor(u));
      continue;
    }
    const target = chosenTarget.get(u.id);
    if (!target) continue;
    const roll = rollFor(u);
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + roll);
    events.push({ type: 'attack', unitId: u.id, side: u.side, kind: u.kind, targetId: target.id, roll, damage: roll });
  }

  for (const u of engaged) {
    const roll = defenceRoll.get(u.id);
    if (roll === undefined) continue;
    events.push({ type: 'defend', unitId: u.id, side: u.side, kind: u.kind, roll });
  }

  // Apply summed incoming damage — a defending unit's own roll mitigates
  // it (e.g. 3 attackers' rolls summed, minus its one defence roll); an
  // attacking unit takes the full sum, since it chose to trade blows
  // instead of guarding.
  for (const u of engaged) {
    const inc = incoming.get(u.id);
    if (!inc) continue;
    const net = defenceRoll.has(u.id) ? Math.max(0, inc - defenceRoll.get(u.id)!) : inc;
    applyDamage(u.id, net);
  }

  // ── Apply combat damage, remove the dead ──
  for (const [unitId, amount] of Array.from(damage)) {
    const unit = living.find((u) => u.id === unitId);
    if (unit) unit.hp -= amount;
  }
  const dead = living.filter((u) => u.hp <= 0);
  for (const u of dead) events.push({ type: 'death', unitId: u.id, side: u.side, kind: u.kind });
  let alive = living.filter((u) => u.hp > 0);

  // ── Steps 4/5: movement, non-engaged units only, planned against a
  // "shadow map" rather than executed sequentially. A cell is only ever a
  // real obstacle if an engaged unit (guaranteed to stay put) occupies it —
  // a mover's own current cell is never treated as blocking, since it's
  // itself vacating this turn, regardless of where in priority order it
  // sits relative to whoever wants to step into it. Destinations are still
  // claimed in priority order (closest-to-enemy first) so two movers can't
  // both plan into the same free cell, but a lower-priority unit is no
  // longer blocked by a higher-priority unit simply not having moved yet.
  // (Known simplification: if a mover that another unit planned around ends
  // up unable to move itself — fully boxed in — both units can end up
  // sharing a cell. Accepted as a rare edge case of planning against
  // intent rather than sequential execution.)
  const movers = priorityOrder.filter((u) => attackerCount(u) === 0 && alive.some((a) => a.id === u.id));
  const moverIds = new Set(movers.map((m) => m.id));

  const staticOccupancy = new Map<string, string>(); // cells held by units that never move this turn
  for (const u of alive) {
    if (!moverIds.has(u.id)) staticOccupancy.set(`${u.col},${u.row}`, u.id);
  }

  const plannedMove = new Map<string, Cell>(); // unitId -> destination

  // BFS obstacle set: engaged units (never move) plus whatever earlier,
  // higher-priority movers have already claimed as *their* first step this
  // turn — grows as the loop proceeds, so later movers path around cells
  // that are genuinely spoken for, not just occupied-for-now.
  const blocked = new Set<string>(staticOccupancy.keys());

  for (const mover of movers) {
    const unit = alive.find((u) => u.id === mover.id)!;
    const target = nearestLivingEnemy(unit, alive);
    if (!target) continue;

    const dest = firstStepToward(unit, target, state.cols, state.rows, blocked);

    if (dest) {
      blocked.add(`${dest.col},${dest.row}`);
      plannedMove.set(unit.id, dest);
    } else {
      events.push({ type: 'skip', unitId: unit.id, side: unit.side, kind: unit.kind });
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
