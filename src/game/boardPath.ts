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

/** How far ahead the road picker looks: the most a die can move. */
export const ROUTE_STEPS = 6;

/** One road ahead: the slots stepped onto, in order, ending on `dest`. */
export interface Route {
  dest: number;
  path: number[];
  /** Every step follows the board's own direction. */
  forward: boolean;
}

/**
 * Every distinct road exactly `steps` moves from `from` -- two roads may end on the same slot.
 * With `anyDirection` a road may also run against the board's direction, but never turns
 * straight back onto the slot it just left, and never runs back down a fork's stem after
 * arriving along one of its branches. `cameFrom` is the slot the player stepped from onto `from`.
 */
export function routesAhead(
  board: GameState,
  from: number,
  steps: number = ROUTE_STEPS,
  anyDirection = false,
  cameFrom = -1
): Route[] {
  const routes: Route[] = [];
  const behind = (pos: number) =>
    board.links.flatMap((next, slot) => (next.includes(pos) && !board.links[pos]?.includes(slot) ? [slot] : []));

  const walk = (pos: number, path: number[], forward: boolean) => {
    if (path.length === steps) {
      routes.push({ dest: pos, path, forward });
      return;
    }

    const left = path.length >= 2 ? path[path.length - 2] : path.length === 1 ? from : cameFrom;
    const ahead = board.links[pos] ?? [];
    for (const next of ahead) {
      if (anyDirection && next === left) continue;
      walk(next, [...path, next], forward);
    }

    if (!anyDirection) return;
    const offBranch = ahead.length >= 2 && ahead.includes(left);
    if (offBranch) return;
    for (const prev of behind(pos)) {
      if (prev !== left) walk(prev, [...path, prev], false);
    }
  };

  walk(from, [], true);
  return routes;
}

/**
 * The road between junctions each slot lies on: the stretches left once every junction (a slot
 * with three or more neighbours) is taken out. -1 for a junction itself.
 */
export function roadStretches(board: GameState): number[] {
  const near: number[][] = board.links.map(() => []);
  board.links.forEach((next, slot) =>
    next.forEach((n) => {
      if (!near[slot].includes(n)) near[slot].push(n);
      if (near[n] && !near[n].includes(slot)) near[n].push(slot);
    })
  );

  const stretch: number[] = near.map((n) => (n.length >= 3 ? -1 : -2));
  let id = 0;
  stretch.forEach((s, start) => {
    if (s !== -2) return;
    const queue = [start];
    stretch[start] = id;
    while (queue.length) {
      for (const n of near[queue.pop()!]) {
        if (stretch[n] === -2) {
          stretch[n] = id;
          queue.push(n);
        }
      }
    }

    id++;
  });
  return stretch;
}
