import React, { useMemo, useState } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import TileCard from './TileCard';
import { sellTile } from '../actions/sellTile';
import { say } from '../utils/say';
import '../styles/PlayerStatsTable.css';
import { isMobileLayout } from './board/common';

interface Props {
  board: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export const PlayerStatsTable: React.FC<Props> = ({ board, setGameState }) => {
  const activePlayer = board.activePlayer as Player;

  // Map owned tiles and keep their indices
  const owned = useMemo(() => {
    const res: { tile: Tile; idx: number }[] = [];
    board.tiles.forEach((t: any, idx: number) => {
      if (t && t.owner === activePlayer.name) res.push({ tile: t as Tile, idx });
    });
    return res;
  }, [board, activePlayer.name]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Helper to commit board changes preserving GameState prototype
  function commitGameStateChange(mutatedGameState: GameState) {
    const newGameState = Object.assign(
      new GameState(mutatedGameState.tiles, mutatedGameState.players),
      mutatedGameState
    ) as GameState;
    setGameState(newGameState);
  }

  function handleUpgrade(tile: Tile, tileIdx: number) {
    const currentLevel = tile.level || 1;
    const nextLevel = currentLevel + 1;
    const upgradePrices = tile.upgradePrices || {};
    const nextPrice = upgradePrices[nextLevel];

    if (!nextPrice) return;

    if (
      (activePlayer.gold || 0) < (nextPrice.gold || 0) ||
      (activePlayer.units || 0) < (nextPrice.units || 0)
    ) {
      return;
    }

    activePlayer.gold = (activePlayer.gold || 0) - (nextPrice.gold || 0);
    activePlayer.units = (activePlayer.units || 0) - (nextPrice.units || 0);
    tile.level = nextLevel;
    say(`${activePlayer.name} upgraded ${tile.name} to level ${nextLevel}`, 'info');
    commitGameStateChange(board);
    setSelectedIdx(null);
  }

  async function handleSell(tile: Tile, tileIdx: number) {
    const refunds = sellTile(board, activePlayer, tileIdx);

    commitGameStateChange(board);

    say(
      `${activePlayer.name} sold ${tile.name} and received ${refunds.gold}🟡 and ${refunds.units}🧍`,
      'info'
    );

    setSelectedIdx(null);
  }

  const paneStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isMobileLayout() ? 'column' : 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 12,
    width: '100%',
    boxSizing: 'border-box',
  };

  const rightStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  };

  return (
    <div style={paneStyle}>
      <div style={rightStyle}>
        {owned.length === 0 && <div style={{ color: '#888' }}>No owned tiles</div>}

        {owned.map(({ tile, idx }) => {
          const isSelected = selectedIdx === idx;
          const currentLevel = tile.level || 1;
          const maxLevel = 3;
          const canUpgrade =
            currentLevel < maxLevel &&
            tile.upgradePrices &&
            tile.upgradePrices[currentLevel + 1] &&
            (activePlayer.gold ?? 0) >= (tile.upgradePrices[currentLevel + 1].gold || 0) &&
            (activePlayer.units ?? 0) >= (tile.upgradePrices[currentLevel + 1].units || 0);

          return (
            <div key={idx} style={{ position: 'relative' }}>
              <div
                onClick={() => setSelectedIdx(isSelected ? null : idx)}
                style={{ cursor: 'pointer' }}
              >
                <TileCard tile={tile} />
              </div>

              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    background: '#fff',
                    color: '#000',
                    padding: 8,
                    borderRadius: 6,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    minWidth: 160,
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => handleUpgrade(tile, idx)}
                    disabled={!canUpgrade}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: canUpgrade ? '#2ecc71' : '#ddd',
                      color: canUpgrade ? '#fff' : '#666',
                      cursor: canUpgrade ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Upgrade
                  </button>

                  <button
                    onClick={() => handleSell(tile, idx)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: '#e74c3c',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Sell
                  </button>

                  <button
                    onClick={() => setSelectedIdx(null)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: '#fff',
                      color: '#333',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerStatsTable;
