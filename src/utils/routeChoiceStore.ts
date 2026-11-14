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

/** The roads ahead of the active player and which one is picked -- a random one until the player chooses. */
export function routeChoice(board: GameState): { routes: Route[]; selected: number } {
  const routes = routesAhead(board, board.activePlayer.position);
  const key = keyFor(board);
  if (!choice || choice.key !== key || choice.index >= routes.length) {
    choice = { key, index: Math.floor(Math.random() * routes.length) };
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
