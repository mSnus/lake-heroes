import { CharacterId, CHARACTER_EMOJI } from '../ai/characters';
import type { Player } from '../game/Player';
import { MONEY_START, UNITS_START } from '../game/constants';

export interface PlayerSetup {
  name: string;
  color: string;
  lightColor: string;
  image: string;
  gold: number;
  units: number;
  position: number;
  isComputer?: boolean;
  character?: CharacterId;
}

/** The seats of a finished/abandoned game, ready to prefill the next game's setup. */
export function setupFromPlayers(players: Player[]): PlayerSetup[] {
  return players.map((p) => {
    // Bots get their character emoji appended to the name at game start -- take it off again.
    const suffix = p.isComputer && p.character ? ` ${CHARACTER_EMOJI[p.character]}` : '';
    return {
      name: suffix && p.name.endsWith(suffix) ? p.name.slice(0, -suffix.length) : p.name,
      color: p.color,
      lightColor: p.lightColor,
      image: p.image,
      gold: MONEY_START,
      units: UNITS_START,
      position: 0,
      isComputer: p.isComputer,
      character: p.character,
    };
  });
}
