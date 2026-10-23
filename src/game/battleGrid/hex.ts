export interface Cell {
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

export function hexDistance(a: Cell, b: Cell): number {
  const aa = toAxial(a);
  const ab = toAxial(b);
  const dq = aa.q - ab.q;
  const dr = aa.r - ab.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

// Real on-screen position (even rows shifted +0.5) — used as a tie-break
// metric ("which of several equally-hex-close options is visually nearest"),
// since hex distance alone ties constantly, and to tell front from back.
export function visualPos(cell: Cell): { x: number; y: number } {
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

export function neighborOffsetsFor(row: number): Cell[] {
  return row % 2 === 0 ? NEIGHBOR_OFFSETS_EVEN_ROW : NEIGHBOR_OFFSETS_ODD_ROW;
}

/** In-bounds hex neighbours of a cell on the offset grid. */
export function adjacentCells(col: number, row: number, cols: number, rows: number): Cell[] {
  const out: Cell[] = [];
  for (const off of neighborOffsetsFor(row)) {
    const c = col + off.col;
    const r = row + off.row;
    if (c >= 0 && c < cols && r >= 0 && r < rows) out.push({ col: c, row: r });
  }

  return out;
}

/** Rows ordered nearest-to-center first. */
export function rowsByCenterDistance(rows: number): number[] {
  const centerRow = (rows - 1) / 2;
  return Array.from({ length: rows }, (_, r) => r).sort((a, b) => Math.abs(a - centerRow) - Math.abs(b - centerRow));
}
