import { useSyncExternalStore } from 'react';
import type { GameState } from '../game/GameState';
import { Route, routesAhead } from '../game/boardPath';

/** The road picked for the coming roll, remembered per turn and starting square. */
let choice: { key: string; index: number } | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version++;
  listeners.forEach((l) => l());
}

const keyFor = (board: GameState) => `${board.activePlayer.id}:${board.activePlayer.position}:${board.turns}`;

/** Roads from the player's position that cross none of the tiles their last move passed. Failing
 * that, those that at least don't step straight back onto the tile they came from; failing that, all. */
function openRoutes(board: GameState): Route[] {
  const player = board.activePlayer;
  const all = routesAhead(board, player.position, undefined, true);
  const passed = player.lastPathEnd === player.position ? (player.lastPath ?? []) : [];
  if (!passed.length) return all;

  const fresh = all.filter((r) => !r.path.some((slot) => passed.includes(slot)));
  if (fresh.length) return fresh;
  const cameFrom = passed[passed.length - 1];
  const notBack = all.filter((r) => !r.path.includes(cameFrom));
  return notBack.length ? notBack : all;
}

/** The roads from the active player and which one is picked. A player may pick a road in any
 * direction; until they do, it's a random one of those leading forward. */
export function routeChoice(board: GameState): { routes: Route[]; selected: number } {
  const routes = openRoutes(board);
  const key = keyFor(board);
  if (!choice || choice.key !== key || choice.index >= routes.length) {
    const forward = routes.map((r, i) => (r.forward ? i : -1)).filter((i) => i >= 0);
    const pool = forward.length ? forward : routes.map((_, i) => i);
    choice = { key, index: pool[Math.floor(Math.random() * pool.length)] };
  }

  return { routes, selected: choice.index };
}

export function chosenRoute(board: GameState): Route {
  const { routes, selected } = routeChoice(board);
  return routes[selected];
}

/** Picks a road ending on `dest`; tapping the same end again switches between the roads that reach it. */
export function tapRouteEnd(board: GameState, dest: number): void {
  const { routes, selected } = routeChoice(board);
  const ending = routes.map((r, i) => (r.dest === dest ? i : -1)).filter((i) => i >= 0);
  if (!ending.length) return;
  const at = ending.indexOf(selected);
  choice = { key: keyFor(board), index: at >= 0 ? ending[(at + 1) % ending.length] : ending[0] };
  emit();
}

export function resetRouteChoice(): void {
  choice = null;
  emit();
}

/** Re-renders the caller whenever the pick changes. */
export function useRouteChoiceVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version
  );
}
