import React from 'react';
import { GameState } from '../game/GameState';
import { currentYear, currentYearTurn } from '../game/year';

/** The season each turn of the year is lived through, in order. Indexed
 * modulo its own length so a change to TURNS_PER_YEAR can't land on an
 * undefined. */
const SEASON_EMOJI = ['🌞', '⛅', '🌾', '🍂', '🌨️', '❄️', '🌱', '🌾'];

/** Where the shared calendar stands, shown over the map's corner -- see
 * game/year.ts. Deliberately wordless: the tooltip's "year · turn/total"
 * is the only text, so it needs no translating. */
export const YearIndicator: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const turn = currentYearTurn(gameState);
  return (
    <div className="year-indicator" title={`${currentYear(gameState)} · ${turn}/${SEASON_EMOJI.length}`}>
      {SEASON_EMOJI[(turn - 1) % SEASON_EMOJI.length]}
    </div>
  );
};

export default YearIndicator;
