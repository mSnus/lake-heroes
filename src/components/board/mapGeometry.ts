import type { BoardMap } from '../../game/mapgen/generateMap';

/** One grid cell's side, in units of the board viewport's width (cqi): 4 cells across when zoomed in. */
export const CELL_CQI = 25;
/** Matches .tile's own 14.8cqi box. */
const TILE_CQI = 14.8;

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

/** The scenery cell nearest the middle of the map, where the dragon lairs. */
export function dragonCell(map: BoardMap): { x: number; y: number } {
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
