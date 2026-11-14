import React from 'react';
import type { BoardMap } from '../../game/mapgen/generateMap';
import { DIRS, exitsOf } from '../../game/mapgen/roads';
import { dragonCell } from './mapGeometry';

const SCENERY = ['🌲', '🌳', '🌲', '⛰️', '🌾', '🌲', '🪨', '🌳'];

/** Stable per-cell pick, so scenery doesn't reshuffle on every render. */
const sceneryFor = (i: number) => {
  const r = Math.abs(Math.sin(i * 12.9898 + 4.1414) * 43758.5453) % 1;
  return r < 0.6 ? SCENERY[Math.floor(r * 13) % SCENERY.length] : null;
};

/** Sketch of a generated board: grass, scenery and the road network, one unit per grid cell. */
export const RoadMap: React.FC<{ map: BoardMap }> = ({ map }) => {
  const segments: [number, number, number, number][] = [];
  map.cells.forEach((mask, i) => {
    const cx = (i % map.cols) + 0.5;
    const cy = Math.floor(i / map.cols) + 0.5;
    for (const d of exitsOf(mask)) segments.push([cx, cy, cx + DIRS[d][0] * 0.5, cy + DIRS[d][1] * 0.5]);
  });

  const lair = dragonCell(map);
  const line = (s: [number, number, number, number], k: number, cls: string) => (
    <line key={`${cls}-${k}`} className={cls} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />
  );

  return (
    <svg className="road-map" viewBox={`0 0 ${map.cols} ${map.rows}`} preserveAspectRatio="none" aria-hidden>
      <rect width={map.cols} height={map.rows} className="road-map-grass" />
      {map.cells.map((mask, i) => {
        const x = i % map.cols;
        const y = Math.floor(i / map.cols);
        const emoji = mask || (x === lair.x && y === lair.y) ? null : sceneryFor(i);
        return emoji ? (
          <text key={`s-${i}`} x={x + 0.5} y={y + 0.55} className="road-map-scenery">
            {emoji}
          </text>
        ) : null;
      })}
      {segments.map((s, k) => line(s, k, 'road-map-edge'))}
      {segments.map((s, k) => line(s, k, 'road-map-road'))}
    </svg>
  );
};

export default RoadMap;
