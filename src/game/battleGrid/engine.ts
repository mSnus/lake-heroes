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
} from '../constants';
import { placeArmy } from './placement';
import { BattleSide, GridBattleState, GridUnit, StepTurnOptions, TurnEvent, TurnResult, UnitKind } from './types';

interface Cell {
  col: number;
  row: number;
}

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

const NEIGHBOR_OFFSETS: Cell[] = [
  { col: -1, row: -1 },
  { col: -1, row: 0 },
  { col: -1, row: 1 },
  { col: 0, row: -1 },
  { col: 0, row: 1 },
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
];

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function hpFor(kind: UnitKind): number {
  return kind === 'rider' ? RIDER_HP : MILITIA_HP;
}

function rollDamage(kind: UnitKind, pctBonus: number, flatBonus: number, rng: () => number): number {
  const [min, max] = kind === 'rider' ? [RIDER_DMG_MIN, RIDER_DMG_MAX] : [MILITIA_DMG_MIN, MILITIA_DMG_MAX];
  const base = rollInRange(min, max, rng);
  return Math.max(0, Math.round(base * (1 + pctBonus) + flatBonus));
}

/** Build a fresh battle, both armies placed on opposite long edges, riders
 * filling the front rows (closest to the enemy) and militia the back. */
export function createBattle(
  attacker: { militia: number; riders: number },
  defender: { militia: number; riders: number },
  cols: number = BATTLEFIELD_COLS,
  rows: number = BATTLEFIELD_ROWS
): GridBattleState {
  let stableIndex = 0;
  const units: GridUnit[] = [];

  // Militia fill first (placeArmy fills columns outward from the edge, so
  // earlier-pushed units land in the back rows) and riders fill last, so
  // riders end up in the front rows — closest to the enemy.
  const buildSide = (side: BattleSide, comp: { militia: number; riders: number }) => {
    const sideUnits: GridUnit[] = [];
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
      sideUnits.push({
        id: `${side}-${stableIndex}`,
        side,
        kind: 'rider',
        hp: hpFor('rider'),
        maxHp: hpFor('rider'),
        col: 0,
        row: 0,
        stableIndex: stableIndex++,
      });
    }
    placeArmy(sideUnits, side, cols, rows);
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
  return living.filter((v) => v.side !== u.side && chebyshev(u, v) === 1);
}

function nearestEnemyDistance(u: GridUnit, living: GridUnit[]): number {
  let best = Infinity;
  for (const v of living) {
    if (v.side === u.side) continue;
    const d = chebyshev(u, v);
    if (d < best) best = d;
  }
  return best;
}

function nearestLivingEnemy(u: GridUnit, living: GridUnit[]): GridUnit | undefined {
  let best: GridUnit | undefined;
  let bestDist = Infinity;
  for (const v of living) {
    if (v.side === u.side) continue;
    const d = chebyshev(u, v);
    if (d < bestDist) {
      bestDist = d;
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

  const claimedDest = new Map<string, string>(); // "col,row" -> claiming unitId
  const plannedMove = new Map<string, Cell>(); // unitId -> destination

  for (const mover of movers) {
    const unit = alive.find((u) => u.id === mover.id)!;
    const target = nearestLivingEnemy(unit, alive);
    if (!target) continue;

    const primaryDc = sign(target.col - unit.col);
    const primaryDr = sign(target.row - unit.row);
    const candidates = NEIGHBOR_OFFSETS.map((off) => ({ col: unit.col + off.col, row: unit.row + off.row, off }))
      .filter((c) => c.col >= 0 && c.col < state.cols && c.row >= 0 && c.row < state.rows)
      .sort((a, b) => {
        const distA = chebyshev(a, target);
        const distB = chebyshev(b, target);
        if (distA !== distB) return distA - distB;
        const aPrimary = a.off.col === primaryDc && a.off.row === primaryDr ? 0 : 1;
        const bPrimary = b.off.col === primaryDc && b.off.row === primaryDr ? 0 : 1;
        return aPrimary - bPrimary;
      });

    const dest = candidates.find((c) => {
      const key = `${c.col},${c.row}`;
      return !staticOccupancy.has(key) && !claimedDest.has(key);
    });

    if (dest) {
      claimedDest.set(`${dest.col},${dest.row}`, unit.id);
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
