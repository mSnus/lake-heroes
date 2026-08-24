import React from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { TileClaimScreen } from '../components/TileClaimScreen';
import { showScreen } from '../utils/screenStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { planClaimGarrison } from '../ai/botPlans';
import { setTileGarrison } from './garrisonTile';
import { remainingCapacity, garrisonSlotCapacity } from '../game/army';

export interface TileClaimScreenParams {
  tile: Tile;
  player: Player;
  gameState: GameState;
  updateGameState: (board: GameState) => void;
}

/**
 * Show (or headlessly resolve) the garrison-setting screen after claiming a
 * tile -- a real player gets the interactive TileClaimScreen (which
 * self-drives for a bot via its own effect); a headless run applies the
 * exact same garrison decision (planClaimGarrison) with nothing rendered,
 * so the two can't diverge. The one place both real-battle wins
 * (BattleScreen's handleClose) and a free undefended-tile claim
 * (claimUndefendedTile.ts) should reach for this screen from.
 */
export function showTileClaimScreen(params: TileClaimScreenParams): void {
  const { tile, player, gameState, updateGameState } = params;
  if (isHeadlessRun()) {
    // Mirrors TileClaimScreen's own totalMilitiaPool/maxGarrison derivation.
    const totalMilitiaPool = player.militia + tile.garrisonMilitia;
    const maxGarrison = Math.min(
      tile.garrisonMilitia +
        remainingCapacity(tile.garrisonMilitia, tile.garrisonRiders, tile.garrisonSlots, 'militia', garrisonSlotCapacity()),
      totalMilitiaPool
    );
    const amount = planClaimGarrison(player, maxGarrison, totalMilitiaPool);
    if (amount > 0) {
      setTileGarrison(gameState, player, tile, amount);
      updateGameState(gameState);
    }
    return;
  }
  showScreen({ content: React.createElement(TileClaimScreen, params) });
}
