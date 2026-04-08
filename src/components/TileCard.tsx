import React from 'react';
import { Tile } from '../game/Tile';
import '../styles/TileCard.css';
import { say } from '../utils/say';
import { GameState } from '../game/GameState';
import { sellTile } from '../actions/sellTile';
import { buyTile } from '../actions/buyTile';
import { gameEvent } from '../utils/events';
import { SPRITE_SIZE } from '../game/constants';

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
  updateGameState?: (board: GameState) => void;
  couldBuy?: boolean;
};

export const TileCard: React.FC<TileCardProps> = ({
  tile,
  mode = 'display',
  gameState,
  updateGameState,
  couldBuy = false,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (!tile || !tile.name) return null;

  const groupColor = tile.groupColor;
  const bonusType = getBonusType(tile);

  const pricelevel1 = fmtPrice(tile.prices['1']?.gold ?? 0, tile.prices['1']?.units ?? 0);
  const pricelevel2 = fmtPrice(tile.prices['2']?.gold ?? 0, tile.prices['2']?.units ?? 0);
  const pricelevel3 = fmtPrice(tile.prices['3']?.gold ?? 0, tile.prices['3']?.units ?? 0);

  const bonus = (level: number) => tile.bonuses[level] ?? 0;
  const defence = (level: number) => tile.defences[level] ?? 0;

  const class1 = tile.isOwned() && tile.level < 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class2 = tile.isOwned() && tile.level == 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class3 = tile.isOwned() && tile.level == 3 ? 'tc-td level-highlighted' : 'tc-td';

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

    if (!window.confirm(`Really upgrade ${tile.name}?`)) return;

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
    tile._level = nextLevel;
    say(`${activePlayer.name} upgraded ${tile.name} to level ${nextLevel}`, 'info');
    updateGameState && updateGameState(gameState);
  };

  const handleClose = () => {
    gameEvent('displayTile', {});
  };

  const handleSell = () => {
    if (!gameState || !activePlayer) return;

    if (!window.confirm(`Sell ${tile.name}, seriously?`)) return;

    const refunds = sellTile(gameState, activePlayer, tile);

    updateGameState && updateGameState(gameState);

    say(
      `${activePlayer.name} sold ${tile.name} and received ${refunds.gold}🟡 and ${refunds.units}🧍`,
      'info'
    );
  };

  const handleInfoClick = () => {
    setExpanded(!expanded);
  };

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gameState || !updateGameState) return;

    buyTile(gameState, updateGameState);
  };

  return (
    <div className="tile-card">
      <div
        className="tile-card-header"
        style={{
          background: groupColor + 'e0',
          overflow: 'clip',
          maxHeight: `${SPRITE_SIZE / 2}px`,
        }}
      >
        {tile.sprite && (
          <div
            className={'tile-sprite-box'}
            style={{
              height: `${SPRITE_SIZE}px`,
              width: `${SPRITE_SIZE}px`,
              marginLeft: `-${SPRITE_SIZE * 0.36}px`,
              marginTop: `-8px`,
              overflow: 'clip',
            }}
          >
            <div
              style={{
                width: `${SPRITE_SIZE}px`,
                height: `${SPRITE_SIZE}px`,
                border: `3px solid ${groupColor}70`,
                borderRadius: '0%',
                backgroundImage: `url(assets/sprites2.png)`,
                backgroundSize: '460px 460px',
                backgroundPositionX: `-${tile.sprite.x * SPRITE_SIZE}px`,
                backgroundPositionY: `-${tile.sprite.y * SPRITE_SIZE}px`,
                flexShrink: 0,
                zIndex: 6000,
              }}
            />
          </div>
        )}

        <div className="tile-card-title">{tile.name}</div>

        {mode === 'display' && (
          <button
            onClick={() => handleClose()}
            className="tile-card-button"
            style={{ fontSize: '12px', filter: 'grayscale(100%)', opacity: 0.5 }}
          >
            ❌
          </button>
        )}
      </div>

      {tile.isOwnable && (
        <div className="tile-card-body">
          <div className="tile-card-base-level">
            {tile.owner && (
              <div className="tile-card-base-info">
                <div className="tile-card-base-row">
                  <div className="diamonds" style={{ textAlign: 'center' }}>
                    {Array.from({ length: tile.level }).map((_, d) => (
                      <div
                        key={d}
                        className="diamond"
                        style={{
                          background:
                            gameState?.players.find((p) => p.name === tile.owner)?.color || '#444',
                          width: '12px',
                          height: '12px',
                        }}
                      />
                    ))}
                  </div>

                  {tile.owner !== activePlayer?.name && (
                    <div>
                      <div className="big-icon-hint">
                        <div>{tile.fee}🟡</div>
                        <div>fee</div>
                      </div>
                    </div>
                  )}

                  {tile.owner === activePlayer?.name && (
                    <div>
                      <div className="big-icon-hint">
                        <div>
                          +{bonus(tile.level)} {bonusType === 'gold' ? '🟡' : '👬'}
                        </div>
                        <div>per turn</div>
                      </div>
                    </div>
                  )}

                  <div></div>

                  <div className="big-icon-hint">
                    <div>{tile.defence} 🛡️</div>
                    <div>defence</div>
                  </div>
                </div>
              </div>
            )}

            {!tile.owner && (
              <div className="tile-card-base-info">
                <div className="tile-card-base-row">
                  <div>
                    <div>
                      <div>
                        <div>to own:</div>
                        <span
                          style={
                            couldBuy && ((activePlayer?.gold ?? 0) < (tile.currentPrice.gold ?? 0))
                              ? { color: '#ff4444' }
                              : {}
                          }
                        >
                          {couldBuy &&
                            (activePlayer?.gold ?? 0) < (tile.currentPrice.gold ?? 0) &&
                            '🔻'}
                          {tile.currentPrice.gold ?? 0} 🟡
                        </span>
                        {'  '}
                        <span
                          style={
                            couldBuy && (activePlayer?.units ?? 0) < (tile.currentPrice.units ?? 0)
                              ? { color: '#ff4444' }
                              : {}
                          }
                        >
                          {couldBuy &&
                            (activePlayer?.units ?? 0) < (tile.currentPrice.units ?? 0) &&
                            '🔻'}
                          {tile.currentPrice.units ?? 0}🧍
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {couldBuy && (activePlayer?.gold ?? 0) >= (tile.currentPrice.gold ?? 0) && (activePlayer?.units ?? 0) >= (tile.currentPrice.units ?? 0) && (
                      <button className="game-menu-button" onClick={(e) => handleBuyClick(e)}>
                        Buy
                      </button>
                    )}
                  </div>
                </div>
                <div className="tile-card-base-row">
                  <div className="big-icon-hint">
                    +{bonus(tile.level)} {bonusType === 'gold' ? '🟡' : '👬'}
                    <div>per turn</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {mode === 'owned' && (
            <div className="tile-card-actions">
              <a onClick={() => handleSell()} className={'tile-card-button'}>
                <div className="big-icon-hint">
                  <div>🪙</div>
                  <div>sell</div>
                </div>
              </a>

              <a
                onClick={() => handleUpgrade()}
                className={'tile-card-button' + (canUpgrade ? '' : ' disabled')}
              >
                <div className="big-icon-hint">
                  <div>⬆️</div>
                  <div>upgrade</div>
                </div>
              </a>

              <a
                onClick={() => handleInfoClick()}
                className={'tile-card-button'}
                style={{ width: mode !== 'owned' ? '100%' : 'unset' }}
              >
                <div className="big-icon-hint">
                  <div>ℹ️</div>
                  <div>info</div>
                </div>
              </a>
            </div>
          )}

          {expanded && (
            <div className="tile-card-table-wrap">
              <table className="tile-card-table">
                <thead>
                  <tr>
                    <th className="tc-th">🚩</th>
                    <th className="tc-th">
                      <div className="circular-path" style={{ paddingTop: '5px' }}>
                        🗘
                      </div>
                    </th>
                    <th className="tc-th">🛡️</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={class1}>{pricelevel1}</td>
                    <td className={class1}>
                      +{bonus(1)} {bonusType === 'gold' ? '🟡' : '👬'}
                    </td>
                    <td className={class1}>{defence(1)} </td>
                  </tr>
                  <tr>
                    <td className={class2}>+{pricelevel2}</td>
                    <td className={class2}>
                      +{bonus(2)} {bonusType === 'gold' ? '🟡' : '👬'}
                    </td>
                    <td className={class2}>{defence(2)} </td>
                  </tr>
                  <tr>
                    <td className={class3}>+{pricelevel3}</td>
                    <td className={class3}>
                      +{bonus(3)} {bonusType === 'gold' ? '🟡' : '👬'}
                    </td>
                    <td className={class3}>{defence(3)} </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!tile.isOwnable && tile.description && (
        <div
          className="tile-card-description"
          dangerouslySetInnerHTML={{ __html: tile.description }}
        />
      )}
    </div>
  );
};

export default TileCard;
