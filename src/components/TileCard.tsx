import React from 'react';
import { Tile } from '../game/Tile';
import groups from '../settings/groups.json';
import '../styles/TileCard.css';
import { Player } from '../game/Player';
import { say } from '../utils/say';
import { GameState } from '../game/GameState';
import { debug } from 'console';
import { sellTile } from '../actions/sellTile';

const fmtPrice = (gold: number, units: number): string => {
  const hasGold = gold > 0;
  const hasUnits = units > 0;
  if (hasGold && hasUnits) return `${gold} 🟡 ${units} 🧍`;
  if (hasGold) return `${gold} 🟡`;
  if (hasUnits) return `${units} 🧍`;
  return '0';
};

const getBonusType = (tile: Tile): 'gold' | 'units' => {
  if (tile.bonusType) return tile.bonusType;
  // Fallback rule
  return tile.group === 'Camps' || tile.group === 'Towers' ? 'units' : 'gold';
};

// Add exported props type for TileCard
export type TileCardProps = {
  tile: Tile;
  mode?: 'display' | 'owned';
  gameState?: GameState;
  updateGameState?: (board: any) => void;
};

export const TileCard: React.FC<TileCardProps> = ({
  tile,
  mode = 'display',
  gameState,
  updateGameState,
}) => {
  if (!tile) return null;

  const groupMeta = (groups as { name: string; icon: string; color: string }[]).find(
    (g) => g.name === tile.group
  );
  const groupIcon = groupMeta?.icon ?? '';
  const groupColor = groupMeta?.color ?? '#eee';
  const bonusType = getBonusType(tile);

  const pricelevel1 = fmtPrice(tile.prices['1']?.gold ?? 0, tile.prices['1']?.units ?? 0);
  const pricelevel2 = fmtPrice(tile.prices['2']?.gold ?? 0, tile.prices['2']?.units ?? 0);
  const pricelevel3 = fmtPrice(tile.prices['3']?.gold ?? 0, tile.prices['3']?.units ?? 0);

  const bonus = (level: 1 | 2 | 3) => tile.bonuses[level] ?? 0;
  const defence = (level: 1 | 2 | 3) => tile.defences[level] ?? 0;

  const class1 = (tile.level ?? 0) < 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class2 = (tile.level ?? 0) == 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class3 = (tile.level ?? 0) == 3 ? 'tc-td level-highlighted' : 'tc-td';

  let canUpgrade = false;
  const activePlayer = gameState?.activePlayer ?? null;

  if (mode === 'owned' && activePlayer) {
    const currentLevel = tile.level || 1;
    const maxLevel = 3;
    canUpgrade =
      currentLevel < maxLevel &&
      tile.prices &&
      tile.prices[currentLevel + 1] &&
      (activePlayer.gold ?? 0) >= (tile.prices[currentLevel + 1].gold || 0) &&
      (activePlayer.units ?? 0) >= (tile.prices[currentLevel + 1].units || 0);
  }

  const handleUpgrade = () => {
    const currentLevel = tile.level || 1;
    const nextLevel = currentLevel + 1;
    const prices = tile.prices || {};
    const nextPrice = prices[nextLevel];

    if (!nextPrice || !activePlayer || !gameState) return;

    if (
      (activePlayer.gold || 0) < (nextPrice.gold || 0) ||
      (activePlayer.units || 0) < (nextPrice.units || 0)
    ) {
      return;
    }

    gameState.players[gameState.playerOrder[gameState.activePlayerIndex]].gold =
      (activePlayer.gold || 0) - (nextPrice.gold || 0);
    gameState.players[gameState.playerOrder[gameState.activePlayerIndex]].units =
      (activePlayer.units || 0) - (nextPrice.units || 0);
    tile.level = nextLevel;
    say(`${activePlayer.name} upgraded ${tile.name} to level ${nextLevel}`, 'info');
    updateGameState && updateGameState(gameState);
  };

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('displayTitle', {}));
  };

  const handleSell = () => {
    if (!gameState || !activePlayer) return;

    const refunds = sellTile(gameState, activePlayer, tile);

    updateGameState && updateGameState(gameState);

    say(
      `${activePlayer.name} sold ${tile.name} and received ${refunds.gold}🟡 and ${refunds.units}🧍`,
      'info'
    );
  };

  return (
    <div className="tile-card">
      <div className="tile-card-header" style={{ background: groupColor }}>
        {mode === 'owned' && (
          <button
            onClick={() => handleSell()}
            className="tile-card-button"
            style={{ fontSize: '18px', opacity: 0.8 }}
          >
            🪙
          </button>
        )}
        {groupIcon} {tile.group}
        {mode === 'owned' && (
          <button
            onClick={() => handleUpgrade()}
            className="tile-card-button"
            style={{ fontSize: '16px' }}
            disabled={!canUpgrade}
          >
            ⬆️
          </button>
        )}
        {mode === 'display' && (
          <button
            onClick={() => handleClose()}
            className="tile-card-button"
            style={{ fontSize: '16px', filter: 'grayscale(100%)' }}
          >
            ❌
          </button>
        )}
      </div>

      <div className="tile-card-title">
        {tile.name} {(tile.level ?? 1) > 1 ? `(Level ${tile.level})` : ''}
      </div>

      {tile.isOwnable && (
        <div className="tile-card-body">
          <div className="tile-card-table-wrap">
            <table className="tile-card-table">
              <thead>
                <tr>
                  <th className="tc-th">Price</th>
                  <th className="tc-th">Bonus</th>
                  <th className="tc-th">Defence</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={class1}>{pricelevel1}</td>
                  <td className={class1}>
                    +{bonus(1)} {bonusType === 'gold' ? '🟡' : '🧍'}
                  </td>
                  <td className={class1}>{defence(1)} 🧍</td>
                </tr>
                <tr>
                  <td className={class2}>{pricelevel2}</td>
                  <td className={class2}>
                    +{bonus(2)} {bonusType === 'gold' ? '🟡' : '🧍'}
                  </td>
                  <td className={class2}>{defence(2)} 🧍</td>
                </tr>
                <tr>
                  <td className={class3}>{pricelevel3}</td>
                  <td className={class3}>
                    +{bonus(3)} {bonusType === 'gold' ? '🟡' : '🧍'}
                  </td>
                  <td className={class3}>{defence(3)} 🧍</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {mode === 'full' && tile.owner && <div className="tile-owner">owned by {tile.owner}</div>}
      {!tile.isOwnable && tile.description && (
        <div className="tile-card-description">{tile.description}</div>
      )}
    </div>
  );
};

export default TileCard;
