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
const GENERATE_ATTEMPTS = 20;

const randInt = (min: number, max: number, rng: () => number) => min + Math.floor(rng() * (max - min + 1));
const key = (c: Cell) => `${c.col},${c.row}`;

function tryGenerateObstacles(cols: number, rows: number, rng: () => number): BattleObstacle[] {
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

  // Grouped: grown one random hex neighbour at a time from a seed cell.
  const groups = randInt(OBSTACLE_GROUPS_MIN, OBSTACLE_GROUPS_MAX, rng);
  for (let g = 0; g < groups; g++) {
    const seed = randomFree();
    if (!seed) break;
    const size = randInt(GROUP_SIZE_MIN, GROUP_SIZE_MAX, rng);
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

    if (group.length < GROUP_SIZE_MIN) continue;
    const emoji = pickEmoji();
    for (const c of group) {
      taken.add(key(c));
      obstacles.push({ ...c, emoji });
    }
  }

  const singles = Math.round(cols * rows * SINGLE_OBSTACLE_RATIO);
  for (let i = 0; i < singles; i++) {
    const c = randomFree();
    if (!c) break;
    taken.add(key(c));
    obstacles.push({ ...c, emoji: pickEmoji() });
  }

  return obstacles;
}

/** Whether the left edge can still reach the right edge around the obstacles. */
function edgesConnected(cols: number, rows: number, obstacles: BattleObstacle[]): boolean {
  const blocked = new Set(obstacles.map(key));
  const queue: Cell[] = [];
  const seen = new Set<string>();
  for (let row = 0; row < rows; row++) {
    const c = { col: 0, row };
    if (!blocked.has(key(c))) {
      queue.push(c);
      seen.add(key(c));
    }
  }

  while (queue.length) {
    const c = queue.shift()!;
    if (c.col === cols - 1) return true;
    for (const n of adjacentCells(c.col, c.row, cols, rows)) {
      const k = key(n);
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push(n);
    }
  }

  return false;
}

/**
 * Scatter obstacles before either army is placed: 1-5 grouped obstacles of
 * 2-4 adjacent cells plus a few single cells, all clear of the starting
 * columns at both edges, and never sealing one edge off from the other.
 */
export function generateObstacles(cols: number, rows: number, rng: () => number = Math.random): BattleObstacle[] {
  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt++) {
    const obstacles = tryGenerateObstacles(cols, rows, rng);
    if (edgesConnected(cols, rows, obstacles)) return obstacles;
  }

  return [];
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
