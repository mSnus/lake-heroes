import { BattleObstacle, GridUnit } from './types';

// Random cosmetic battlefield terrain -- impassable, unattackable, purely a
// movement obstacle. Picked per-cell at random from this set.
export const OBSTACLE_EMOJIS = ['⛰️', '🌲', '🌳', '🌵', '🕳️'];

// Share of the grid's cells that become obstacles.
export const OBSTACLE_RATIO = 0.07;

/**
 * Scatter obstacles across the grid before either army is placed, so their
 * presence can affect where units end up (see relocateUnitsOffObstacles).
 * Picks OBSTACLE_RATIO of all cells uniformly at random, each a random
 * emoji from OBSTACLE_EMOJIS.
 */
export function generateObstacles(cols: number, rows: number, rng: () => number = Math.random): BattleObstacle[] {
  const cells: { col: number; row: number }[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) cells.push({ col, row });
  }

  // Fisher-Yates, same pattern as components/board/common.ts's shuffle.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const count = Math.round(cells.length * OBSTACLE_RATIO);
  return cells.slice(0, count).map((c) => ({
    ...c,
    emoji: OBSTACLE_EMOJIS[Math.floor(rng() * OBSTACLE_EMOJIS.length)],
  }));
}

/**
 * After a side's units are placed (placeArmy or placeFormation, both purely
 * geometric and unaware of obstacles), move any unit that landed on an
 * obstacle cell to the back of its own army instead -- the first free,
 * non-obstacle cell found scanning outward from that side's home edge
 * (col 0 for the attacker, the last col for the defender), column by
 * column. Mutates `col`/`row` in place, same as the placement functions.
 */
export function relocateUnitsOffObstacles(
  units: GridUnit[],
  side: 'attacker' | 'defender',
  cols: number,
  rows: number,
  obstacles: BattleObstacle[]
): void {
  const obstacleKeys = new Set(obstacles.map((o) => `${o.col},${o.row}`));
  const onObstacle = units.filter((u) => obstacleKeys.has(`${u.col},${u.row}`));
  if (onObstacle.length === 0) return;

  const occupied = new Set(units.map((u) => `${u.col},${u.row}`));
  const homeCol = side === 'attacker' ? 0 : cols - 1;
  const step = side === 'attacker' ? 1 : -1;

  const findBackCell = (): { col: number; row: number } | undefined => {
    for (let offset = 0; offset < cols; offset++) {
      const col = homeCol + step * offset;
      if (col < 0 || col >= cols) break;
      for (let row = 0; row < rows; row++) {
        const key = `${col},${row}`;
        if (obstacleKeys.has(key) || occupied.has(key)) continue;
        return { col, row };
      }
    }
    return undefined;
  };

  for (const unit of onObstacle) {
    const key = `${unit.col},${unit.row}`;
    occupied.delete(key);
    const dest = findBackCell();
    if (dest) {
      unit.col = dest.col;
      unit.row = dest.row;
      occupied.add(`${dest.col},${dest.row}`);
    } else {
      // Board fully packed -- shouldn't happen at a 10% obstacle density,
      // but leave the unit where it is rather than lose it.
      occupied.add(key);
    }
  }
}

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
