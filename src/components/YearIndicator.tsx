import React from 'react';
import { GameState } from '../game/GameState';
import { currentYear, currentYearTurn } from '../game/year';

/** One color per turn of the year, in order -- the wedge for that turn's
 * position on the dial. Indexed modulo its own length, same reasoning as
 * the emoji list this replaced: a change to TURNS_PER_YEAR can't land on an
 * undefined. */
const SECTOR_COLORS = [
  '#38A9D6',
  '#3C9992',
  '#4BB28B',
  '#57C785',
  '#A4D26B',
  '#EDDD53',
  '#53EDBF',
  '#53D6ED',
];

const SIZE = 24; // px -- 1.5rem at the default 16px root
const CENTER = SIZE / 2;
const STROKE_WIDTH = 1;
const RADIUS = CENTER - STROKE_WIDTH / 2; // inset so the 1px outline isn't clipped
const SECTOR_DEG = 360 / SECTOR_COLORS.length;

function polarPoint(angleDeg: number): [number, number] {
  // -90 so 0deg lands at 12 o'clock (SVG's own 0deg is 3 o'clock) --
  // increasing angleDeg from there sweeps clockwise.
  const rad = (Math.PI / 180) * (angleDeg - 90);
  return [CENTER + RADIUS * Math.cos(rad), CENTER + RADIUS * Math.sin(rad)];
}

/** One pie wedge from startDeg to endDeg (0deg = 12 o'clock, increasing
 * clockwise) -- every wedge here spans well under 180deg, so the arc's
 * large-arc-flag is always 0. */
function sectorPath(startDeg: number, endDeg: number): string {
  const [x1, y1] = polarPoint(startDeg);
  const [x2, y2] = polarPoint(endDeg);
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`;
}

/** Where the shared calendar stands, shown over the map's corner -- see
 * game/year.ts. A circular gauge: one wedge per turn of the year, filled in
 * clockwise from the top as the year progresses, resetting bare at rollover.
 * Deliberately wordless: the tooltip's "year · turn/total" is the only
 * text, so it needs no translating. */
export const YearIndicator: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const turn = currentYearTurn(gameState);
  const elapsed = Math.min(turn, SECTOR_COLORS.length);

  return (
    <div
      className="year-indicator"
      title={`${currentYear(gameState)} · ${turn}/${SECTOR_COLORS.length}`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="#abab93c4" />
        {Array.from({ length: elapsed }, (_, i) => (
          <path
            key={i}
            d={sectorPath(i * SECTOR_DEG, (i + 1) * SECTOR_DEG)}
            fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
          />
        ))}
        {/* Drawn last, fill="none", so the outline stays crisp over every
            wedge rather than being half-covered by whichever one is filled
            right up to the same radius. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="#3b402cc4"
          strokeWidth={STROKE_WIDTH}
        />
      </svg>
    </div>
  );
};

export default YearIndicator;
