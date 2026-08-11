import { GridUnit } from './types';

/**
 * Fill a side's starting position: a square block (or, when the count isn't
 * a perfect square, a rectangle with an uneven last column) hugging the
 * grid's long-edge side nearest that army (col 0 for the attacker, the last
 * col for the defender), vertically centered rather than pinned to the top
 * row. Mutates `col`/`row` on each unit in place. Units must already be in
 * fill order (riders first, then militia — the vanguard convention carried
 * over from the old duel system's tier ordering).
 */
export function placeArmy(units: GridUnit[], side: 'attacker' | 'defender', cols: number, rows: number): void {
  const n = units.length;
  if (n === 0) return;

  // Square side length, clamped so the block is never taller than the grid
  // (in which case it just widens instead, same as a normal uneven-last-
  // column fill).
  const blockRows = Math.min(rows, Math.ceil(Math.sqrt(n)));

  const startCol = side === 'attacker' ? 0 : cols - 1;
  const step = side === 'attacker' ? 1 : -1;
  const startRow = Math.floor((rows - blockRows) / 2);

  units.forEach((unit, i) => {
    const colOffset = Math.floor(i / blockRows);
    const rowWithin = i % blockRows;
    const col = startCol + step * colOffset;
    unit.col = Math.max(0, Math.min(cols - 1, col));
    unit.row = Math.max(0, Math.min(rows - 1, startRow + rowWithin));
  });
}
