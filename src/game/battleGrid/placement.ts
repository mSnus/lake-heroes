import { GridUnit } from './types';

/**
 * Fill a side's starting position: a square block (or, when the count isn't
 * a perfect square, a rectangle with an uneven last column) hugging the
 * grid's long-edge side nearest that army (col 0 for the attacker, the last
 * col for the defender), vertically centered rather than pinned to the top
 * row. Column offset grows *away* from that edge (toward the enemy), so
 * units earlier in the array land in the back rows and later ones in the
 * front — callers should order militia first, then riders, so riders end up
 * in front, closest to the enemy (see engine.ts's createBattle). Mutates
 * `col`/`row` on each unit in place.
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

  // Every column except a possible trailing one is filled completely (all
  // blockRows cells). That trailing column — riders, the front line closest
  // to the enemy, since they fill last — would otherwise only get pinned to
  // the block's TOP edge instead of sharing its vertical center, leaving the
  // front line lopsided and forcing units aimed at it into unnecessary
  // diagonal correction instead of a straight approach. Centering it within
  // the same row range as every other column keeps the whole block, and
  // its front edge specifically, actually symmetric.
  const fullCols = Math.floor(n / blockRows);
  const remainder = n % blockRows;
  const partialColOffset = remainder > 0 ? Math.floor((blockRows - remainder) / 2) : 0;

  units.forEach((unit, i) => {
    const colOffset = Math.floor(i / blockRows);
    const rowWithin = i % blockRows;
    const isPartialCol = colOffset === fullCols;
    const row = isPartialCol ? partialColOffset + rowWithin : rowWithin;
    const col = startCol + step * colOffset;
    unit.col = Math.max(0, Math.min(cols - 1, col));
    unit.row = Math.max(0, Math.min(rows - 1, startRow + row));
  });
}
