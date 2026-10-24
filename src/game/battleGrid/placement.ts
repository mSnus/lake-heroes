import { BattleObstacle, BattleSide, GridUnit } from './types';
import { Cell, adjacentCells, rowsByCenterDistance } from './hex';

// Random cosmetic battlefield terrain -- impassable, unattackable, purely a
// movement obstacle. Every cell of a grouped obstacle shares one emoji.
export const OBSTACLE_EMOJIS = ['⛰️', '🌲', '🌳', '🌵', '🕳️'];

// Share of the grid's cells that become single-cell obstacles.
const SINGLE_OBSTACLE_RATIO = 0.04;
// Plus this many grouped obstacles of GROUP_SIZE_MIN..MAX adjacent cells.
const OBSTACLE_GROUPS_MIN = 1;
const OBSTACLE_GROUPS_MAX = 5;
const GROUP_SIZE_MIN = 2;
const GROUP_SIZE_MAX = 4;
// Columns at each edge kept clear: armies open and reinforce there.
const CLEAR_EDGE_COLS = 2;
// Never let a placement drop the number of independent left-right routes
// below this -- a single narrow choke point funnels every unit through one
// cell, so there's always this many separate ways across.
const MIN_PASSAGES = 3;
// Alternate cells/seeds tried for one obstacle (or group) before it's
// dropped rather than breaking the passage guarantee.
const PLACEMENT_ATTEMPTS = 15;

const randInt = (min: number, max: number, rng: () => number) => min + Math.floor(rng() * (max - min + 1));
const key = (c: Cell) => `${c.col},${c.row}`;

/** Vertex-disjoint left-to-right routes around `obstacles`, via max-flow on
 * a graph where each free cell is split into an in/out pair joined by a
 * capacity-1 edge -- so a path can't reuse a cell another path already
 * claimed. Stops as soon as `cap` is reached (all this ever needs to know
 * is "at least MIN_PASSAGES", not the exact count). */
function countDisjointPassages(cols: number, rows: number, obstacles: BattleObstacle[], cap: number): number {
  const blocked = new Set(obstacles.map(key));
  const SRC = 'S';
  const SINK = 'T';
  const inNode = (c: Cell) => `${key(c)}i`;
  const outNode = (c: Cell) => `${key(c)}o`;

  const adj = new Map<string, Map<string, number>>();
  const addEdge = (a: string, b: string, capacity: number) => {
    if (!adj.has(a)) adj.set(a, new Map());
    if (!adj.has(b)) adj.set(b, new Map());
    adj.get(a)!.set(b, (adj.get(a)!.get(b) ?? 0) + capacity);
    if (!adj.get(b)!.has(a)) adj.get(b)!.set(a, 0);
  };

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const c = { col, row };
      if (blocked.has(key(c))) continue;
      addEdge(inNode(c), outNode(c), 1);
      if (col === 0) addEdge(SRC, inNode(c), 1);
      if (col === cols - 1) addEdge(outNode(c), SINK, 1);
      for (const n of adjacentCells(col, row, cols, rows)) {
        if (!blocked.has(key(n))) addEdge(outNode(c), inNode(n), 1);
      }
    }
  }

  let flow = 0;
  while (flow < cap) {
    const parent = new Map<string, string>();
    const visited = new Set<string>([SRC]);
    const queue: string[] = [SRC];
    let reached = false;
    while (queue.length && !reached) {
      const u = queue.shift()!;
      const edges = Array.from((adj.get(u) ?? new Map<string, number>()).entries());
      for (const [v, c] of edges) {
        if (c <= 0 || visited.has(v)) continue;
        visited.add(v);
        parent.set(v, u);
        if (v === SINK) {
          reached = true;
          break;
        }

        queue.push(v);
      }
    }

    if (!reached) break;
    let v = SINK;
    while (v !== SRC) {
      const u = parent.get(v)!;
      adj.get(u)!.set(v, adj.get(u)!.get(v)! - 1);
      adj.get(v)!.set(u, adj.get(v)!.get(u)! + 1);
      v = u;
    }

    flow++;
  }

  return flow;
}

/**
 * Scatter obstacles before either army is placed: 1-5 grouped obstacles of
 * 2-4 adjacent cells plus a few single cells, all clear of the starting
 * columns at both edges. Each piece is only kept if it still leaves at
 * least MIN_PASSAGES independent routes across the board -- otherwise it's
 * tried again at a different spot (up to PLACEMENT_ATTEMPTS times), and
 * dropped rather than ever narrowing the board to fewer passages.
 */
export function generateObstacles(cols: number, rows: number, rng: () => number = Math.random): BattleObstacle[] {
  const interior: Cell[] = [];
  for (let col = CLEAR_EDGE_COLS; col < cols - CLEAR_EDGE_COLS; col++) {
    for (let row = 0; row < rows; row++) interior.push({ col, row });
  }

  const inInterior = (c: Cell) => c.col >= CLEAR_EDGE_COLS && c.col < cols - CLEAR_EDGE_COLS;
  const taken = new Set<string>();
  const obstacles: BattleObstacle[] = [];
  const pickEmoji = () => OBSTACLE_EMOJIS[Math.floor(rng() * OBSTACLE_EMOJIS.length)];
  const randomFree = (): Cell | undefined => {
    const free = interior.filter((c) => !taken.has(key(c)));
    return free.length ? free[Math.floor(rng() * free.length)] : undefined;
  };

  // Tentatively commits `group`, but only keeps it if the board still has
  // room for MIN_PASSAGES routes afterward -- otherwise undoes it.
  const tryCommit = (group: Cell[], emoji: string): boolean => {
    for (const c of group) {
      taken.add(key(c));
      obstacles.push({ ...c, emoji });
    }

    if (countDisjointPassages(cols, rows, obstacles, MIN_PASSAGES) >= MIN_PASSAGES) return true;

    for (const c of group) {
      taken.delete(key(c));
      obstacles.pop();
    }

    return false;
  };

  const growGroup = (seed: Cell, size: number): Cell[] => {
    const group: Cell[] = [seed];
    const inGroup = new Set([key(seed)]);
    while (group.length < size) {
      const frontier = group
        .flatMap((c) => adjacentCells(c.col, c.row, cols, rows))
        .filter((c) => inInterior(c) && !taken.has(key(c)) && !inGroup.has(key(c)));
      if (frontier.length === 0) break;
      const next = frontier[Math.floor(rng() * frontier.length)];
      group.push(next);
      inGroup.add(key(next));
    }

    return group;
  };

  const groups = randInt(OBSTACLE_GROUPS_MIN, OBSTACLE_GROUPS_MAX, rng);
  for (let g = 0; g < groups; g++) {
    const size = randInt(GROUP_SIZE_MIN, GROUP_SIZE_MAX, rng);
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const seed = randomFree();
      if (!seed) break;
      const group = growGroup(seed, size);
      if (group.length >= GROUP_SIZE_MIN && tryCommit(group, pickEmoji())) break;
    }
  }

  const singles = Math.round(cols * rows * SINGLE_OBSTACLE_RATIO);
  for (let i = 0; i < singles; i++) {
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const c = randomFree();
      if (!c) break;
      if (tryCommit([c], pickEmoji())) break;
    }
  }

  return obstacles;
}

/** A side's home edge column (where it opens and reinforces) and its forward step. */
export function homeEdge(side: BattleSide, cols: number): { col: number; step: number } {
  return side === 'attacker' ? { col: 0, step: 1 } : { col: cols - 1, step: -1 };
}

/**
 * Line a side's opening units up along its own edge: the edge column first,
 * then the next one in, each filled from the vertical center outward.
 * Earlier units land at the back, so callers pass the ones meant to stand in
 * front last. Mutates `col`/`row` in place.
 */
export function placeAtEdge(
  units: GridUnit[],
  side: BattleSide,
  cols: number,
  rows: number,
  obstacles: BattleObstacle[]
): void {
  const blocked = new Set(obstacles.map(key));
  const { col: home, step } = homeEdge(side, cols);
  const order = rowsByCenterDistance(rows);
  const cells: Cell[] = [];
  for (let offset = 0; offset < cols && cells.length < units.length; offset++) {
    for (const row of order) {
      const c = { col: home + step * offset, row };
      if (!blocked.has(key(c))) cells.push(c);
    }
  }

  units.forEach((u, i) => {
    u.col = cells[i].col;
    u.row = cells[i].row;
  });
}

/** Free cells on a side's own edge column, center rows first. */
export function freeEdgeCells(
  side: BattleSide,
  cols: number,
  rows: number,
  obstacles: BattleObstacle[],
  units: GridUnit[]
): Cell[] {
  const { col } = homeEdge(side, cols);
  const taken = new Set([...obstacles.map(key), ...units.map(key)]);
  return rowsByCenterDistance(rows)
    .map((row) => ({ col, row }))
    .filter((c) => !taken.has(key(c)));
}
