import { DIRS, opposite, ringDist, canAddExit, dirBetween, diagonalVertex, exitsOf, isValidPiece } from './roads';
import { inDegrees, lapLengths, stepsAfterCastle } from './analyzeMap';

export interface BoardMap {
  cols: number;
  rows: number;
  /** Road exit mask per cell, row-major; 0 = scenery. */
  cells: number[];
  /** Grid cell of each slot; slot 0 is the King's Castle. */
  slots: { x: number; y: number }[];
}

export interface GeneratedMap {
  map: BoardMap;
  links: number[][];
}

export const MAP_COLS = 11;
export const MAP_ROWS = 8;
const ROAD_SHARE = 0.65;
const MIN_SIDE_ROAD_GAP = 3;
// Each side road adds one fork (a 3-exit cell with a choice of way).
export const MAX_FORKS = 3;
// No fork in the first this many steps after the castle (no quick way back to it).
export const CASTLE_CLEAR_STEPS = 3;
// The shortest lap must be at least this share of the longest one.
const MIN_LAP_RATIO = 0.85;
const MAX_SIDE_ROAD_CELLS = 10;
const CORNER_CUT_CHANCE = 0.6;
const SEARCH_BUDGET = 3000;

type Cell = { x: number; y: number };

/** The dragon's lake: 2 columns by 3 rows in the middle of the map, kept free of roads. */
export function lairBlock(cols: number, rows: number): { x: number; y: number; w: number; h: number } {
  return { x: Math.floor((cols - 2) / 2), y: Math.floor((rows - 3) / 2), w: 2, h: 3 };
}

const inLair = (cols: number, rows: number, x: number, y: number) => {
  const b = lairBlock(cols, rows);
  return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
};

const randInt = (n: number) => Math.floor(Math.random() * n);
const shuffled = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
};

/** A random hole-free blob on the coarse grid between cell centres; its
 * outline is a simple closed loop through cell centres. */
function blobOutline(cols: number, rows: number, targetLen: number): Cell[] | null {
  const W = cols - 1;
  const H = rows - 1;
  const inBlob = new Set<number>();
  const has = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && inBlob.has(j * W + i);

  const perimeter = () => {
    let p = 0;
    inBlob.forEach((k) => {
      const i = k % W;
      const j = Math.floor(k / W);
      p += [0, 2, 4, 6].filter((d) => !has(i + DIRS[d][0], j + DIRS[d][1])).length;
    });
    return p;
  };

  // Adding a cell keeps the blob hole-free and pinch-free when its blob
  // neighbours form one unbroken arc that touches it on a side.
  const canGrow = (i: number, j: number) => {
    const ring = DIRS.map(([dx, dy]) => has(i + dx, j + dy));
    const runs = ring.filter((b, k) => b && !ring[(k + 7) % 8]).length;
    return runs === 1 && ring.some((b, k) => b && k % 2 === 0);
  };

  // The outline must reach every edge of the grid, so the blob spans the whole coarse grid.
  const spans = () => {
    const is = Array.from(inBlob, (k) => k % W);
    const js = Array.from(inBlob, (k) => Math.floor(k / W));
    return Math.min(...is) === 0 && Math.max(...is) === W - 1 && Math.min(...js) === 0 && Math.max(...js) === H - 1;
  };

  inBlob.add((Math.floor(H / 2) + randInt(2)) * W + Math.floor(W / 2) - 1 + randInt(3));
  while (perimeter() < targetLen || !spans()) {
    const candidates: [number, number][] = [];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) if (!has(i, j) && canGrow(i, j)) candidates.push([i, j]);
    }

    if (!candidates.length) return null;
    const [i, j] = candidates[randInt(candidates.length)];
    inBlob.add(j * W + i);
  }

  // Clockwise outline: each blob side not shared with the blob is an edge
  // with the blob on its right; corners of the coarse grid are grid cells.
  const next = new Map<number, number>();
  const key = (x: number, y: number) => y * cols + x;
  inBlob.forEach((k) => {
    const i = k % W;
    const j = Math.floor(k / W);
    if (!has(i, j - 1)) next.set(key(i, j), key(i + 1, j));
    if (!has(i + 1, j)) next.set(key(i + 1, j), key(i + 1, j + 1));
    if (!has(i, j + 1)) next.set(key(i + 1, j + 1), key(i, j + 1));
    if (!has(i - 1, j)) next.set(key(i, j + 1), key(i, j));
  });

  const start = next.keys().next().value as number;
  const loop: Cell[] = [];
  let cur = start;
  do {
    loop.push({ x: cur % cols, y: Math.floor(cur / cols) });
    cur = next.get(cur)!;
  } while (cur !== start && loop.length <= next.size);

  return loop.length === next.size ? loop : null;
}

const dirOf = (a: Cell, b: Cell) => dirBetween(a.x, a.y, b.x, b.y);

/** Replaces some 90° corners with a diagonal shortcut, dropping the corner cell. */
function cutCorners(loop: Cell[]): Cell[] {
  const p = [...loop];
  const at = (i: number) => p[(i + p.length) % p.length];
  const usedVertices = new Set<string>();
  let i = 0;
  while (i < p.length && p.length > 12) {
    const a = dirOf(at(i - 1), at(i));
    const b = dirOf(at(i), at(i + 1));
    if (ringDist(a, b) === 2 && Math.random() < CORNER_CUT_CHANCE) {
      const m = dirOf(at(i - 1), at(i + 1));
      const before = dirOf(at(i - 2), at(i - 1));
      const after = dirOf(at(i + 1), at(i + 2));
      const v = diagonalVertex(at(i - 1).x, at(i - 1).y, m);
      if (m >= 0 && ringDist(before, m) <= 2 && ringDist(m, after) <= 2 && v && !usedVertices.has(v)) {
        usedVertices.add(v);
        p.splice(i, 1);
        i++;
        continue;
      }
    }

    i++;
  }

  return p;
}

class Builder {
  masks: number[];
  vertices = new Set<string>();
  rank = new Map<number, number>();
  edges: [number, number][] = [];

  constructor(
    public cols: number,
    public rows: number
  ) {
    this.masks = new Array(cols * rows).fill(0);
  }

  idx = (c: Cell) => c.y * this.cols + c.x;
  inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < this.cols && y < this.rows && !inLair(this.cols, this.rows, x, y);
  roadCount = () => this.masks.filter((m) => m).length;

  link(a: Cell, b: Cell): boolean {
    const d = dirOf(a, b);
    const v = diagonalVertex(a.x, a.y, d);
    if (d < 0 || !this.inside(a.x, a.y) || !this.inside(b.x, b.y)) return false;
    if (!canAddExit(this.masks[this.idx(a)], d) || !canAddExit(this.masks[this.idx(b)], opposite(d))) return false;

    if (v && this.vertices.has(v)) return false;
    this.masks[this.idx(a)] |= 1 << d;
    this.masks[this.idx(b)] |= 1 << opposite(d);
    if (v) this.vertices.add(v);
    this.edges.push([this.idx(a), this.idx(b)]);
    return true;
  }

  /** A forward side road from `a` (a plain 2-exit road cell) through empty
   * cells to a later 2-exit road cell, or null if none fits. */
  carveSideRoad(a: Cell): Cell[] | null {
    const rankA = this.rank.get(this.idx(a))!;
    let budget = SEARCH_BUDGET;
    const usedV = new Set<string>();
    const path: Cell[] = [];

    const search = (cur: Cell, dIn: number): Cell[] | null => {
      if (--budget <= 0) return null;
      for (const d of shuffled([0, 1, 2, 3, 4, 5, 6, 7])) {
        if (path.length === 0 ? !canAddExit(this.masks[this.idx(a)], d) : ringDist(opposite(dIn), d) < 2) continue;
        const nx = cur.x + DIRS[d][0];
        const ny = cur.y + DIRS[d][1];
        if (!this.inside(nx, ny)) continue;
        const v = diagonalVertex(cur.x, cur.y, d);
        if (v && (this.vertices.has(v) || usedV.has(v))) continue;
        const next = { x: nx, y: ny };
        const mask = this.masks[this.idx(next)];

        if (mask) {
          if (path.length === 0 || exitsOf(mask).length !== 2 || !canAddExit(mask, opposite(d))) continue;
          if (this.rank.get(this.idx(next))! - rankA < MIN_SIDE_ROAD_GAP) continue;
          return [a, ...path, next];
        }

        if (path.length >= MAX_SIDE_ROAD_CELLS || path.some((c) => c.x === nx && c.y === ny)) continue;
        path.push(next);
        if (v) usedV.add(v);
        const found = search(next, d);
        if (found) return found;
        path.pop();
        if (v) usedV.delete(v);
      }

      return null;
    };

    return search(a, -1);
  }
}

function tryGenerate(cols: number, rows: number): GeneratedMap | null {
  const outline = blobOutline(cols, rows, 40 + randInt(6));
  if (!outline) return null;
  const loop = cutCorners(outline);
  const b = new Builder(cols, rows);
  for (let k = 0; k < loop.length; k++) {
    if (!b.link(loop[k], loop[(k + 1) % loop.length])) return null;
  }

  // The castle sits on a straight stretch of the main loop.
  const straight = loop
    .map((_, k) => k)
    .filter((k) => {
      const exits = exitsOf(b.masks[b.idx(loop[k])]);
      return exits.length === 2 && ringDist(exits[0], exits[1]) === 4;
    });
  const castleAt = straight.length ? straight[randInt(straight.length)] : 0;
  loop.forEach((c, k) => b.rank.set(b.idx(c), (k - castleAt + loop.length) % loop.length));

  const target = Math.round(cols * rows * ROAD_SHARE);
  let sideRoads = 0;
  for (let attempt = 0; attempt < 400 && b.roadCount() < target && sideRoads < MAX_FORKS; attempt++) {
    const plain = b.masks
      .map((m, i) => (exitsOf(m).length === 2 && b.rank.get(i)! > CASTLE_CLEAR_STEPS ? i : -1))
      .filter((i) => i >= 0);
    if (!plain.length) break;
    const startIdx = plain[randInt(plain.length)];
    const road = b.carveSideRoad({ x: startIdx % cols, y: Math.floor(startIdx / cols) });
    if (!road) continue;
    if (b.roadCount() + road.length - 2 > target + 4) continue;

    const r0 = b.rank.get(b.idx(road[0]))!;
    const r1 = b.rank.get(b.idx(road[road.length - 1]))!;
    // A side road much shorter or longer than the stretch it bypasses would make laps uneven.
    if (Math.abs(r1 - r0 - (road.length - 1)) > (1 - MIN_LAP_RATIO) * loop.length) continue;
    for (let k = 0; k < road.length - 1; k++) b.link(road[k], road[k + 1]);
    sideRoads++;
    for (let k = 1; k < road.length - 1; k++) b.rank.set(b.idx(road[k]), r0 + ((r1 - r0) * k) / (road.length - 1));
  }

  if (b.roadCount() < target - 6) return null;

  const order = Array.from(b.rank.keys()).sort((p, q) => b.rank.get(p)! - b.rank.get(q)!);
  const slotOf = new Map(order.map((cellIdx, slot) => [cellIdx, slot]));
  const links: number[][] = order.map(() => []);
  for (const [from, to] of b.edges) links[slotOf.get(from)!].push(slotOf.get(to)!);

  return {
    map: {
      cols,
      rows,
      cells: b.masks,
      slots: order.map((cellIdx) => ({ x: cellIdx % cols, y: Math.floor(cellIdx / cols) })),
    },
    links,
  };
}

export function generateMap(cols = MAP_COLS, rows = MAP_ROWS): GeneratedMap {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = tryGenerate(cols, rows);
    if (result && validateMap(result).length === 0) return result;
  }

  throw new Error('Could not generate a road map');
}

/** Every rule a generated map must satisfy; returns the broken ones (empty = valid). */
export function validateMap({ map, links }: GeneratedMap): string[] {
  const problems: string[] = [];
  const { cols, rows, cells, slots } = map;
  const vertices = new Set<string>();

  cells.forEach((mask, i) => {
    if (!mask) return;
    const x = i % cols;
    const y = Math.floor(i / cols);
    const exits = exitsOf(mask);
    if (!isValidPiece(mask) || exits.length < 2) problems.push(`bad piece at ${x},${y}`);
    for (const d of exits) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !(cells[ny * cols + nx] & (1 << opposite(d)))) {
        problems.push(`dangling exit at ${x},${y}`);
      }

      const v = diagonalVertex(x, y, d);
      if (v && d < 4) {
        if (vertices.has(v)) problems.push(`crossing diagonals at ${v}`);
        vertices.add(v);
      }
    }
  });

  if (cells.some((mask, i) => mask && inLair(cols, rows, i % cols, Math.floor(i / cols)))) {
    problems.push("a road through the dragon's lake");
  }

  if (slots.length !== cells.filter((m) => m).length) problems.push('slot count != road cells');
  const xs = slots.map((s) => s.x);
  const ys = slots.map((s) => s.y);
  if (Math.min(...xs) > 0 || Math.max(...xs) < cols - 1 || Math.min(...ys) > 0 || Math.max(...ys) < rows - 1) {
    problems.push('roads do not span the whole map');
  }

  const reach = (adj: number[][]) => {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) for (const n of adj[queue.shift()!]) if (!seen.has(n)) seen.add(n), queue.push(n);
    return seen.size;
  };

  const reverse: number[][] = slots.map(() => []);
  links.forEach((outs, s) => outs.forEach((t) => reverse[t].push(s)));
  if (links.filter((outs) => outs.length > 1).length > MAX_FORKS) problems.push('too many forks');
  if (links[0].length !== 1 || inDegrees(links)[0] !== 1) problems.push('the castle is a junction');
  if (stepsAfterCastle(links, CASTLE_CLEAR_STEPS).some((s) => links[s].length > 1)) {
    problems.push('a fork right after the castle');
  }

  if (reach(links) !== slots.length) problems.push('not every slot reachable from the castle');
  if (reach(reverse) !== slots.length) problems.push('not every slot leads back to the castle');

  // Every loop must pass the castle: without slot 0 the graph has no cycles.
  const state = new Array(slots.length).fill(0);
  const cyclic = (s: number): boolean => {
    state[s] = 1;
    for (const t of links[s]) {
      if (t === 0) continue;
      if (state[t] === 1 || (state[t] === 0 && cyclic(t))) return true;
    }

    state[s] = 2;
    return false;
  };

  if (links[0].some((t) => state[t] === 0 && cyclic(t))) problems.push('a loop that skips the castle');
  else {
    const laps = lapLengths(links);
    if (laps.shortest < MIN_LAP_RATIO * laps.longest) problems.push('a short lap back to the castle');
  }

  return problems;
}
