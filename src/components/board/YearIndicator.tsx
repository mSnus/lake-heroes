import React from 'react';
import { GameState } from '../../game/GameState';
import { currentYear, currentYearTurn } from '../../game/year';
import { TURNS_PER_YEAR } from '../../game/constants';
import { sayLocal } from '../../utils/say';
import { useT } from '../../i18n';

/** Two dial sectors per season, in order -- seasonKey's input is still
 * counted in eighths of the year, as it was for the pie this replaced. */
const SECTORS_PER_YEAR = 8;
const SECTORS_PER_TURN = SECTORS_PER_YEAR / TURNS_PER_YEAR;

/** The sprite turns a quarter per turn of the year. */
const DEG_PER_TURN = 90;

function seasonKey(sectors: number): 'winter' | 'spring' | 'summer' | 'autumn' {
  if (sectors <= 2) return 'winter';
  if (sectors <= 4) return 'spring';
  if (sectors <= 6) return 'summer';
  return 'autumn';
}

/** Where the shared calendar stands, shown over the map's corner -- see
 * game/year.ts. A gold disc with a quarter cut out, turned a further quarter
 * clockwise each turn of the year. The rotation is cumulative across years
 * (never wraps back) so the disc doesn't spin backwards at rollover. The
 * dial itself is wordless (the tooltip's "year · turn/total" is the only
 * text on hover); a click announces the season as a local toast. */
export const YearIndicator: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const t = useT();
  const turn = currentYearTurn(gameState);
  const elapsed = Math.min(turn * SECTORS_PER_TURN, SECTORS_PER_YEAR);
  const rotation = (currentYear(gameState) * TURNS_PER_YEAR + turn) * DEG_PER_TURN;

  return (
    <div
      className="year-indicator"
      title={`${currentYear(gameState)} · ${turn}/${TURNS_PER_YEAR}`}
      onClick={() =>
        sayLocal(
          t('yearIndicator.season', { season: t(`yearIndicator.${seasonKey(elapsed)}`) }),
          'info'
        )
      }
    >
      <img
        src="/assets/sprites/year_indicator.png"
        alt=""
        draggable={false}
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </div>
  );
};

export default YearIndicator;
