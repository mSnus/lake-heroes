import React from 'react';
import type { BoardMap } from '../../game/mapgen/generateMap';
import { piecesFor } from '../../game/mapgen/roads';
import { dragonLair } from './mapGeometry';

const SCENERY_DIR = 'assets/scenery/summer';
// Scenery art: a 256px tile at (291, 600) inside a 1024px canvas, as % background-position.
const SCENERY_POSITION = `${((291 / 256) * 100) / 3}% ${((600 / 256) * 100) / 3}%`;
// Scenery for empty cells, with its share; road cells and the lake sit on plain grass.
const SCENERY: [string, number][] = [
  ['grass', 0.45],
  ['bushes', 0.2],
  ['trees', 0.2],
  ['rocks', 0.1],
  ['water', 0.05],
];
// Road images are 380px with the cell in their middle 270px; the ends overlap the neighbours.
const ROAD_SCALE = 380 / 270;
// The lake art is 1024px = 4 cells, its lake centred at (424, 556).
const LAKE_CENTRE = { x: 424 / 256, y: 556 / 256 };

/** Stable per-cell pseudo-random in [0,1), varied by the map itself so boards differ. */
const cellRandom = (i: number, salt: number) => {
  const r = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return r - Math.floor(r);
};

function scenery(roll: number): string {
  let acc = 0;
  for (const [name, share] of SCENERY) {
    acc += share;
    if (roll < acc) return name;
  }

  return SCENERY[0][0];
}

/** A generated board: summer scenery on every cell, the dragon's lake, and road images drawn over them. */
export const RoadMap: React.FC<{ map: BoardMap }> = ({ map }) => {
  const lair = dragonLair(map);
  const salt = map.cells.reduce((sum, m, i) => sum + m * (i + 1), 0) % 997;
  const cellW = 100 / map.cols;
  const cellH = 100 / map.rows;
  const inLair = (x: number, y: number) => x >= lair.x && x < lair.x + lair.w && y >= lair.y && y < lair.y + lair.h;
  // A one-cell lair (older maps) shrinks the 2-column lake to fit.
  const lakeScale = lair.w === 1 ? 0.5 : 1;

  return (
    <div className="map-squares" aria-hidden>
      {map.cells.map((mask, i) => {
        const x = i % map.cols;
        const y = Math.floor(i / map.cols);
        const name = mask || inLair(x, y) ? 'grass' : scenery(cellRandom(i, salt));
        return (
          <div
            key={`s${i}`}
            className="map-square"
            style={{
              left: `${x * cellW}%`,
              top: `${y * cellH}%`,
              // 1px of overlap hides sub-pixel seams between neighbouring squares.
              width: `calc(${cellW}% + 1px)`,
              height: `calc(${cellH}% + 1px)`,
              backgroundImage: `url(${SCENERY_DIR}/${name}.png)`,
              backgroundPosition: SCENERY_POSITION,
            }}
          />
        );
      })}

      <img
        className="map-lake"
        src={`${SCENERY_DIR}/dragon_2x3.png`}
        alt=""
        draggable={false}
        style={{
          left: `${(lair.x + lair.w / 2 - LAKE_CENTRE.x * lakeScale) * cellW}%`,
          top: `${(lair.y + lair.h / 2 - LAKE_CENTRE.y * lakeScale) * cellH}%`,
          width: `${4 * lakeScale * cellW}%`,
          height: `${4 * lakeScale * cellH}%`,
        }}
      />

      {map.cells.map((mask, i) => {
        const pieces = mask ? piecesFor(mask) : [];
        if (!pieces.length) return null;
        const piece = pieces[Math.floor(cellRandom(i, salt + 1) * pieces.length)];
        const x = i % map.cols;
        const y = Math.floor(i / map.cols);
        return (
          <img
            key={`r${i}`}
            className="map-road"
            src={`assets/roads/${piece.image}.png`}
            alt=""
            draggable={false}
            style={{
              left: `${(x + 0.5 - ROAD_SCALE / 2) * cellW}%`,
              top: `${(y + 0.5 - ROAD_SCALE / 2) * cellH}%`,
              width: `${ROAD_SCALE * cellW}%`,
              height: `${ROAD_SCALE * cellH}%`,
              transform: `rotate(${piece.quarterTurns * 90}deg)${piece.mirror ? ' scaleX(-1)' : ''}`,
            }}
          />
        );
      })}
    </div>
  );
};

export default RoadMap;
