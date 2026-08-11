import { GridUnit } from './types';

/**
 * Fill a side's starting position: a square block (or, when the count isn't
 * a perfect square, a rectangle with a narrower back column) hugging the
 * grid's long-edge side nearest that army (col 0 for the attacker, the last
 * col for the defender), vertically centered rather than pinned to the top
 * row. Column offset grows *away* from that edge (toward the enemy), so
 * units earlier in the array land in the back and later ones in the front —
 * callers should order militia first, then riders, so riders end up in
 * front, closest to the enemy (see engine.ts's createBattle). Mutates
 * `col`/`row` on each unit in place.
 */
export function placeArmy(units: GridUnit[], side: 'attacker' | 'defender', cols: number, rows: number): void {
  const n = units.length;
  if (n === 0) return;

  // Square side length, clamped so the block is never taller than the grid
  // (in which case it just widens instead).
  const blockRows = Math.min(rows, Math.ceil(Math.sqrt(n)));

  const startCol = side === 'attacker' ? 0 : cols - 1;
  const step = side === 'attacker' ? 1 : -1;
  const startRow = Math.floor((rows - blockRows) / 2);

  // If n isn't a multiple of blockRows, one column ends up short. That
  // column goes at the BACK (col offset 0), not the front: since riders
  // fill last and land in the highest-offset column, putting the shortfall
  // there instead would leave the front line narrower than a full column.
  // A narrower front is more than just lopsided — the opposing army's
  // nearest-enemy targeting (Euclidean-distance-based) finds that thin
  // front cluster disproportionately attractive from many different rows
  // at once, since being one column closer usually outweighs a modest row
  // offset, so units converge on it instead of advancing in a roughly
  // parallel line. Keeping every column but the backmost one at full
  // strength avoids creating that pull. The short back column is itself
  // centered in the block's row range, same as any column would be.
  const remainder = n % blockRows;
  const firstColCount = remainder > 0 ? remainder : blockRows;
  const firstColOffset = remainder > 0 ? Math.floor((blockRows - remainder) / 2) : 0;

  units.forEach((unit, i) => {
    let colOffset: number;
    let row: number;
    if (i < firstColCount) {
      colOffset = 0;
      row = firstColOffset + i;
    } else {
      const j = i - firstColCount;
      colOffset = 1 + Math.floor(j / blockRows);
      row = j % blockRows;
    }
    const col = startCol + step * colOffset;
    unit.col = Math.max(0, Math.min(cols - 1, col));
    unit.row = Math.max(0, Math.min(rows - 1, startRow + row));
  });
}
