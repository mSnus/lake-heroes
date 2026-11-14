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
}

/** Every distinct road exactly `steps` moves ahead of `from` -- two roads may end on the same slot. */
export function routesAhead(board: GameState, from: number, steps: number = ROUTE_STEPS): Route[] {
  const routes: Route[] = [];
  const walk = (pos: number, path: number[]) => {
    if (path.length === steps) {
      routes.push({ dest: pos, path });
      return;
    }

    for (const next of board.links[pos] ?? []) walk(next, [...path, next]);
  };

  walk(from, []);
  return routes;
}
