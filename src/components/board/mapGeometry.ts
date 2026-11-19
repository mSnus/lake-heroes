import { lairBlock, type BoardMap } from '../../game/mapgen/generateMap';

/** One grid cell's side, in units of the board viewport's width (cqi): 4 cells across when zoomed in. */
export const CELL_CQI = 25;
/** Matches .board-generated .tile's own box (1.875x the classic 14.8cqi). */
export const TILE_CQI = 27.75;

export function layerSizeCqi(map: BoardMap): { w: number; h: number } {
  return { w: map.cols * CELL_CQI, h: map.rows * CELL_CQI };
}

/** A cqi offset as a percentage of the map layer, per axis. */
export function cqiToPct(map: BoardMap, dx: number, dy: number): { x: number; y: number } {
  const { w, h } = layerSizeCqi(map);
  return { x: (dx / w) * 100, y: (dy / h) * 100 };
}

/** Top-left of a slot's tile box, in % of the map layer -- same convention as the classic map.json. */
export function slotPosition(map: BoardMap, slot: number): { x: number; y: number; textPos: string | null } {
  const { x, y } = map.slots[slot];
  const pct = cqiToPct(map, (x + 0.5) * CELL_CQI - TILE_CQI / 2, (y + 0.5) * CELL_CQI - TILE_CQI / 2);
  return { x: pct.x, y: pct.y, textPos: null };
}

/** The scenery cell nearest the middle of the map -- the lair on maps saved before the lake block existed. */
function nearestEmptyToCentre(map: BoardMap): { x: number; y: number } {
  let best = { x: 0, y: 0 };
  let bestDist = Infinity;
  map.cells.forEach((mask, i) => {
    if (mask) return;
    const x = i % map.cols;
    const y = Math.floor(i / map.cols);
    const d = Math.hypot(x + 0.5 - map.cols / 2, y + 0.5 - map.rows / 2);
    if (d < bestDist) {
      bestDist = d;
      best = { x, y };
    }
  });
  return best;
}

/** Where the dragon's lake lies, in cells: the reserved block, or one empty cell on an older map whose roads cross it. */
export function dragonLair(map: BoardMap): { x: number; y: number; w: number; h: number } {
  const block = lairBlock(map.cols, map.rows);
  const clear = map.cells.every((mask, i) => {
    const x = i % map.cols;
    const y = Math.floor(i / map.cols);
    return !mask || x < block.x || x >= block.x + block.w || y < block.y || y >= block.y + block.h;
  });
  if (clear) return block;
  const cell = nearestEmptyToCentre(map);
  return { ...cell, w: 1, h: 1 };
}
