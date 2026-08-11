import { GridUnit } from './types';

/**
 * Fill a side's starting position: the grid's long-edge column nearest that
 * side (col 0 for the attacker, the last col for the defender), top-to-bottom,
 * spilling into the next column inward once a column of `rows` cells is full.
 * Mutates `col`/`row` on each unit in place. Units must already be in fill
 * order (riders first, then militia — the vanguard convention carried over
 * from the old duel system's tier ordering).
 */
export function placeArmy(units: GridUnit[], side: 'attacker' | 'defender', cols: number, rows: number): void {
  const startCol = side === 'attacker' ? 0 : cols - 1;
  const step = side === 'attacker' ? 1 : -1;

  units.forEach((unit, i) => {
    const colOffset = Math.floor(i / rows);
    const row = i % rows;
    const col = startCol + step * colOffset;
    unit.col = Math.max(0, Math.min(cols - 1, col));
    unit.row = row;
  });
}
