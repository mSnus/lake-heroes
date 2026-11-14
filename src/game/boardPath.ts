import type { GameState } from './GameState';
import { TILE_COUNT } from './constants';

/** The classic hand-drawn board: one loop with a single fork at slot 3 that
 * rejoins at 13 (short branch 4-6, long branch 7-12). */
export function classicLinks(): number[][] {
  return Array.from({ length: TILE_COUNT }, (_, i) => {
    if (i === 3) return [4, 7];
    if (i === 6 || i === 12) return [13];
    return [(i + 1) % TILE_COUNT];
  });
}

/** One way to spend a roll: the slots stepped onto, in order, ending on `dest`. */
export interface Route {
  dest: number;
  path: number[];
  /** Whether the route steps onto the King's Castle (slot 0), landing included. */
  crossesStart: boolean;
}

/**
 * Every slot exactly `steps` moves ahead of `from`, one route per slot. When
 * two routes reach the same slot, the one passing the King's Castle wins, so
 * picking a slot never costs its income.
 */
export function routesFor(board: GameState, from: number, steps: number): Route[] {
  const best = new Map<number, Route>();
  const walk = (pos: number, path: number[]) => {
    if (path.length === steps) {
      const crossesStart = path.includes(0);
      const prev = best.get(pos);
      if (!prev || (crossesStart && !prev.crossesStart)) best.set(pos, { dest: pos, path, crossesStart });
      return;
    }

    for (const next of board.links[pos] ?? []) walk(next, [...path, next]);
  };

  walk(from, []);
  return Array.from(best.values());
}

/** Fewest moves from `from` to `target` (0 when already there), Infinity if unreachable. */
export function shortestSteps(board: GameState, from: number, target: number): number {
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const pos = queue.shift()!;
    if (pos === target) return dist.get(pos)!;
    for (const next of board.links[pos] ?? []) {
      if (dist.has(next)) continue;
      dist.set(next, dist.get(pos)! + 1);
      queue.push(next);
    }
  }

  return Infinity;
}
