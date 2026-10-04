import { TILE_COUNT, FORK_START_INDEX, FORK_MERGE_INDEX, FORK_SHORT_PATH, FORK_LONG_PATH } from './constants';
import { ForkChoice } from '../utils/forkChoiceStore';

const SHORT_LAST = FORK_SHORT_PATH[FORK_SHORT_PATH.length - 1];
const LONG_LAST = FORK_LONG_PATH[FORK_LONG_PATH.length - 1];

/**
 * One step of board movement, aware of the map's fork: leaving
 * FORK_START_INDEX branches onto the short or long path per `forkChoice`,
 * and the last tile of either path jumps straight to FORK_MERGE_INDEX
 * instead of falling through into the other path's tile numbers. Every
 * other tile just increments normally, wrapping at TILE_COUNT back to 0 --
 * same as the plain board before the fork existed.
 */
export function nextBoardPosition(from: number, forkChoice: ForkChoice): number {
  if (from === FORK_START_INDEX) return forkChoice === 'long' ? FORK_LONG_PATH[0] : FORK_SHORT_PATH[0];
  if (from === SHORT_LAST || from === LONG_LAST) return FORK_MERGE_INDEX;
  return (from + 1) % TILE_COUNT;
}

/**
 * How many steps of nextBoardPosition it takes to reach the fork's start
 * tile from `from` -- 0 when already standing on it. Either branch reaches
 * it identically (the fork start sits on the loop's common trunk), so the
 * walk arbitrarily takes the short one. Returns TILE_COUNT if it somehow
 * never arrives, which no reachable position does.
 */
export function stepsToFork(from: number): number {
  let pos = from;
  for (let steps = 0; steps < TILE_COUNT; steps++) {
    if (pos === FORK_START_INDEX) return steps;
    pos = nextBoardPosition(pos, 'short');
  }

  return TILE_COUNT;
}

/**
 * Generic form of stepsToFork -- how many steps of nextBoardPosition it
 * takes to reach `targetIdx` from `from` along the given fork branch (0 when
 * already standing on it). Returns TILE_COUNT if it somehow never arrives
 * within a full lap, which no reachable target does.
 */
export function stepsToTile(from: number, targetIdx: number, forkChoice: ForkChoice): number {
  let pos = from;
  for (let steps = 0; steps < TILE_COUNT; steps++) {
    if (pos === targetIdx) return steps;
    pos = nextBoardPosition(pos, forkChoice);
  }

  return TILE_COUNT;
}

/**
 * Simulates `roll` steps of nextBoardPosition from `from`, returning the
 * final landing tile and whether King's Castle (index 0) was passed or
 * landed on along the way -- the fork-aware generalization of the old
 * pure-modulo `position + roll >= TILE_COUNT` check.
 */
export function advanceBoardPosition(
  from: number,
  roll: number,
  forkChoice: ForkChoice
): { finalIndex: number; crossedStart: boolean } {
  let pos = from;
  let crossedStart = false;
  for (let i = 0; i < roll; i++) {
    pos = nextBoardPosition(pos, forkChoice);
    if (pos === 0) crossedStart = true;
  }

  return { finalIndex: pos, crossedStart };
}
