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
