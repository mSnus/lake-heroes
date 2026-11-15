/** Exit directions, clockwise from north: N, NE, E, SE, S, SW, W, NW. */
export const DIRS: [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

export const MAX_EXITS = 3;

export const opposite = (d: number) => (d + 4) % 8;

/** Steps between two directions around the 8-point ring (0..4). */
export const ringDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d);
};

export const exitsOf = (mask: number): number[] => [0, 1, 2, 3, 4, 5, 6, 7].filter((d) => mask & (1 << d));

/** Whether exit `d` can join a cell's road: at most 3 exits, never two neighbouring ends (no turn over 90°). */
export function canAddExit(mask: number, d: number): boolean {
  if (mask & (1 << d)) return false;
  const exits = exitsOf(mask);
  if (exits.length >= MAX_EXITS) return false;
  return exits.every((e) => ringDist(e, d) >= 2);
}

export function isValidPiece(mask: number): boolean {
  const exits = exitsOf(mask);
  if (exits.length > MAX_EXITS) return false;
  return exits.every((a, i) => exits.slice(i + 1).every((b) => ringDist(a, b) >= 2));
}

/** Direction from cell a to its neighbour b, or -1 if they aren't neighbours. */
export function dirBetween(ax: number, ay: number, bx: number, by: number): number {
  return DIRS.findIndex(([dx, dy]) => ax + dx === bx && ay + dy === by);
}

/** The grid corner a diagonal link passes through (only one diagonal may use it), or null for a straight link. */
export function diagonalVertex(x: number, y: number, d: number): string | null {
  if (d % 2 === 0) return null;
  const [dx, dy] = DIRS[d];
  return `${Math.max(x, x + dx)},${Math.max(y, y + dy)}`;
}

/** Painted road pieces in assets/map-squares.jpg (4×4 sheet), by sprite index, with the exits each one has. */
const ROAD_SPRITES: [number, number[]][] = [
  [0, [0, 4]],
  [1, [1, 5]],
  [2, [0, 2]],
  [3, [1, 3]],
  [4, [0, 5]],
  [5, [0, 2, 4]],
  [6, [1, 3, 5]],
  [7, [0, 2, 5]],
  [8, [1, 3, 6]],
];

export interface PieceSprite {
  sprite: number;
  /** Clockwise quarter turns, applied after the mirror. */
  quarterTurns: number;
  mirror: boolean;
}

const mirrored = (d: number) => (8 - d) % 8;

/** Every legal road mask -> the painted piece that draws it once mirrored and/or rotated. */
const PIECE_BY_MASK = (() => {
  const table = new Map<number, PieceSprite>();
  for (const [sprite, exits] of ROAD_SPRITES) {
    for (const mirror of [false, true]) {
      for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) {
        const mask = exits.reduce((m, d) => m | (1 << (((mirror ? mirrored(d) : d) + 2 * quarterTurns) % 8)), 0);
        if (!table.has(mask)) table.set(mask, { sprite, quarterTurns, mirror });
      }
    }
  }

  return table;
})();

export function pieceFor(mask: number): PieceSprite | undefined {
  return PIECE_BY_MASK.get(mask);
}
