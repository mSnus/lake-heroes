import React from 'react';
import type { BoardMap } from '../../game/mapgen/generateMap';
import { pieceFor } from '../../game/mapgen/roads';
import { dragonCell } from './mapGeometry';

const SHEET = 'assets/map-squares.jpg';
const SHEET_COLS = 4;
const DRAGON_LAIR_SPRITE = 14;
// Scenery sprites with their share of empty cells: grass, grass with trees, forest, hill, pond.
const SCENERY: [number, number][] = [
  [9, 0.42],
  [15, 0.08],
  [10, 0.25],
  [11, 0.12],
  [12, 0.07],
  [13, 0.06],
];

/** Stable per-cell pseudo-random in [0,1), varied by the map itself so boards differ. */
const cellRandom = (i: number, salt: number) => {
  const r = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return r - Math.floor(r);
};

function scenerySprite(roll: number): number {
  let acc = 0;
  for (const [sprite, share] of SCENERY) {
    acc += share;
    if (roll < acc) return sprite;
  }

  return SCENERY[0][0];
}

/** A generated board painted with the map-square sheet: road pieces and scenery, one square per cell. */
export const RoadMap: React.FC<{ map: BoardMap }> = ({ map }) => {
  const lair = dragonCell(map);
  const salt = map.cells.reduce((sum, m, i) => sum + m * (i + 1), 0) % 997;

  return (
    <div className="map-squares" aria-hidden>
      {map.cells.map((mask, i) => {
        const x = i % map.cols;
        const y = Math.floor(i / map.cols);
        const piece = mask ? pieceFor(mask) : undefined;
        const sprite = piece
          ? piece.sprite
          : x === lair.x && y === lair.y
            ? DRAGON_LAIR_SPRITE
            : scenerySprite(cellRandom(i, salt));
        const turns = piece ? piece.quarterTurns : 0;
        const step = 100 / (SHEET_COLS - 1);
        return (
          <div
            key={i}
            className="map-square"
            style={{
              left: `${(x * 100) / map.cols}%`,
              top: `${(y * 100) / map.rows}%`,
              // 1px of overlap hides sub-pixel seams between neighbouring squares.
              width: `calc(${100 / map.cols}% + 1px)`,
              height: `calc(${100 / map.rows}% + 1px)`,
              backgroundImage: `url(${SHEET})`,
              backgroundPosition: `${(sprite % SHEET_COLS) * step}% ${Math.floor(sprite / SHEET_COLS) * step}%`,
              transform: `rotate(${turns * 90}deg)${piece?.mirror ? ' scaleX(-1)' : ''}`,
            }}
          />
        );
      })}
    </div>
  );
};

export default RoadMap;
