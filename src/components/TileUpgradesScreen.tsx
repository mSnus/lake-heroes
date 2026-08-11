import React from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { TileInfoScreen } from './TileClaimScreen';

interface TileUpgradesScreenProps {
  tile: Tile;
  player: Player;
  gameState: GameState;
  updateGameState: (board: GameState) => void;
}

export const TileUpgradesScreen: React.FC<TileUpgradesScreenProps> = (props) => (
  <TileInfoScreen {...props} variant="upgrades" />
);

export default TileUpgradesScreen;
