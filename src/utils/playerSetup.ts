import { CharacterId } from '../ai/characters';

export interface PlayerSetup {
  name: string;
  color: string;
  image: string;
  gold: number;
  units: number;
  position: number;
  isComputer?: boolean;
  character?: CharacterId;
}
