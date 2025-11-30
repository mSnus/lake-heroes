import React, { useMemo, useState } from 'react';
import { Board } from '../game/Board';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import TileCard from './TileCard';
import { sellTile } from '../actions/sellTile';
import { say } from '../utils/say';
import '../assets/PlayerStatsTable.css';
import { isMobileLayout } from './board/common';

interface Props {
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board | null>>;
}

export const PlayerStatsTable: React.FC<Props> = ({ board, setBoard }) => {
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

  // Helper to commit board changes preserving Board prototype
  function commitBoardChange(mutatedBoard: Board) {
    const newBoard = Object.assign(
      new Board(mutatedBoard.tiles, mutatedBoard.players),
      mutatedBoard
    ) as Board;
    setBoard(newBoard);
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
    commitBoardChange(board);
    setSelectedIdx(null);
  }

  async function handleSell(tile: Tile, tileIdx: number) {
    const refunds = sellTile(board, activePlayer, tileIdx);

    commitBoardChange(board);

    say(
      `${activePlayer.name} sold ${tile.name} and received ${refunds.gold} gold and ${refunds.units} units`,
      'info'
    );

    setSelectedIdx(null);
  }

  const paneStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: 12,
    width: '100%',
    boxSizing: 'border-box',
  };

  const leftStyle: React.CSSProperties = {
    width: isMobileLayout() ? '15vw' : '100px',
    minWidth: 200,
    background: '#222',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
      <div style={leftStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: activePlayer.color,
              border: '2px solid #fff',
            }}
          />
          <div style={{ fontWeight: 700 }}>{activePlayer.name}</div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div>
            Gold: <strong>{activePlayer.gold ?? 0}</strong>
          </div>
          <div>
            Units: <strong>{activePlayer.units ?? 0}</strong>
          </div>
        </div>
      </div>

      <div style={rightStyle}>
        {owned.length === 0 && <div style={{ color: '#888' }}>No owned tiles</div>}

        {owned.map(({ tile, idx }) => {
          const isSelected = selectedIdx === idx;
          const currentLevel = tile.level || 1;
          const maxLevel = 3;
          const canUpgrade =
            currentLevel < maxLevel &&
            tile.upgradePrices &&
            tile.upgradePrices[String(currentLevel + 1)] &&
            (activePlayer.gold ?? 0) >= (tile.upgradePrices[String(currentLevel + 1)].gold || 0) &&
            (activePlayer.units ?? 0) >= (tile.upgradePrices[String(currentLevel + 1)].units || 0);

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
