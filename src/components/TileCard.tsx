import React from 'react';
import { Tile } from '../game/Tile';
import '../styles/TileCard.css';
import { say } from '../utils/say';
import { GameState } from '../game/GameState';
import { sellTile } from '../actions/sellTile';
import { buyTile } from '../actions/buyTile';
import { gameEvent } from '../utils/events';
import { SPRITE_SIZE } from '../game/constants';
import { syndicateMultiplier } from '../game/syndicate';

const fmtPrice = (gold: number, units: number, join: string = ''): string => {
  const hasGold = gold > 0;
  const hasUnits = units > 0;
  join = join ? ` ${join} ` : '';

  if (hasGold && hasUnits) return `${gold}🟡${join}${units}🧍`;
  if (hasGold) return `${gold}🟡`;
  if (hasUnits) return `${units}🧍`;
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
  const ownerPlayer = gameState?.players.find((p) => p.name === tile.owner) ?? null;
  const ownerColor = ownerPlayer?.color || '#444';

  // Syndicate: the owner holds every ownable tile of this group, which doubles
  // the income bonus.
  const syndicateMult =
    gameState && ownerPlayer ? syndicateMultiplier(gameState, ownerPlayer, tile.group) : 1;
  const isSyndicate = syndicateMult > 1;

  const bonusType = getBonusType(tile);

  // Price cell for the level breakdown table. On the upgrade-target row of an
  // owned tile that the player can't afford, the lacking resource is shown bold
  // red with a 🔻 prefix (same treatment as the "can't own" case).
  const priceCell = (level: number) => {
    const gold = tile.prices[level]?.gold ?? 0;
    const units = tile.prices[level]?.units ?? 0;
    const hasGold = gold > 0;
    const hasUnits = units > 0;
    const isOwnedByActive = mode === 'owned' && tile.owner === activePlayer?.name;
    const isUpgradeTarget = isOwnedByActive && level === nextLevel && !maxLevelReached;
    const lacksGold = !!isUpgradeTarget && !!activePlayer && (activePlayer.gold ?? 0) < gold;
    const lacksUnits = !!isUpgradeTarget && !!activePlayer && (activePlayer.units ?? 0) < units;
    const redBold = { color: '#ff4444', fontWeight: 'bold' as const };

    if (!hasGold && !hasUnits) return <>0</>;

    let icon = 'ᅠ';

    if (lacksGold || lacksUnits) {
      icon = '❌ ';
    } else {
      if (isUpgradeTarget) {
        icon = '⬆️ ';
      }
    }

    return (
      <>
        <span>{icon}</span>
        {hasGold && (
          <span style={lacksGold ? redBold : undefined}>
            {lacksGold && '🔻'}
            {gold}🟡
          </span>
        )}
        {hasGold && hasUnits && ' '}
        {hasUnits && (
          <span style={lacksUnits ? redBold : undefined}>
            {lacksUnits && '🔻'}
            {units}🧍
          </span>
        )}
      </>
    );
  };

  const bonus = (level: number) => (tile.bonuses[level] ?? 0) * syndicateMult;
  const defence = (level: number) => tile.defences[level] ?? 0;

  const diamonds = (level: number = tile.level) =>
    Array.from({ length: level }).map((_, d) => (
      <div key={d} className="diamond" style={{ background: ownerColor }} />
    ));

  const bonusTypeIcon = bonusType === 'gold' ? '🟡' : '👬';

  const class1 = tile.isOwned() && tile.level < 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class2 = tile.isOwned() && tile.level == 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class3 = tile.isOwned() && tile.level == 3 ? 'tc-td level-highlighted' : 'tc-td';

  const activePlayer = gameState?.activePlayer ?? null;
  const cantAfford =
    (activePlayer && (activePlayer.gold ?? 0) < (tile.currentPrice.gold ?? 0)) ||
    (activePlayer && (activePlayer.units ?? 0) < (tile.currentPrice.units ?? 0)) ||
    (tile.requiredFame > 0 && activePlayer && (activePlayer.fame ?? 1) < tile.requiredFame);

  const currentLevel = tile.level || 1;
  const maxLevel = 3;
  const nextLevel = Math.min(currentLevel + 1, maxLevel);
  const nextLevelBonus = bonus(nextLevel);
  const nextLevelDefence = defence(nextLevel);
  const maxLevelReached = currentLevel >= maxLevel;

  const canUpgrade =
    activePlayer &&
    currentLevel < maxLevel &&
    tile.prices &&
    tile.prices[currentLevel + 1] &&
    (activePlayer.gold ?? 0) >= (tile.prices[currentLevel + 1].gold || 0) &&
    (activePlayer.units ?? 0) >= (tile.prices[currentLevel + 1].units || 0);

  const upgradeUnreachable = !canUpgrade || currentLevel === 1;

  const prices = tile.prices || {};
  const nextPrice = prices[nextLevel];

  let sellPrice = { units: 0, gold: 0 };

  for (let i = 1; i <= currentLevel; i++) {
    sellPrice.gold += tile.prices[i].gold;
    sellPrice.units += tile.prices[i].units;
  }

  const handleUpgrade = () => {
    if (
      !window.confirm(
        `Really upgrade ${tile.name} for ${fmtPrice(nextPrice.gold, nextPrice.units, 'and')}?`
      )
    )
      return;

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

    if (
      !window.confirm(
        `Sell ${tile.name} for ${fmtPrice(sellPrice.gold, sellPrice.units, 'and')}, seriously?`
      )
    )
      return;

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
    <div className={'tile-card' + (mode === 'owned' && isSyndicate ? ' syndicate' : '')}>
      <div
        className="tile-card-header"
        style={{
          background: groupColor + 'e0',
          overflow: 'clip',
          maxHeight: `${SPRITE_SIZE / 2}px`,
        }}
      >
        {tile.spriteImage && (
          <div
            className="tile-card-bg"
            style={{
              width: `${SPRITE_SIZE}px`,
              height: `${SPRITE_SIZE}px`,
              backgroundImage: `url(${tile.spriteImage})`,
            }}
          />
        )}

        <div className="tile-card-title" onClick={handleInfoClick} style={{ cursor: 'pointer' }}>
          {tile.name}
        </div>

        {mode === 'display' && (
          <button
            onClick={() => handleClose()}
            className="tile-card-close"
            style={{ fontSize: '12px', filter: 'grayscale(100%)', opacity: 0.5 }}
          >
            ❌
          </button>
        )}
      </div>

      {tile.isOwnable && (
        <div>
          <div className="tile-card-body">
            <div
              className="tile-card-base-level"
              onClick={handleInfoClick}
              style={{ cursor: 'pointer' }}
            >
              {tile.owner && (
                <div className="tile-card-base-info">
                  <div className="tile-card-base-row">
                    <div
                      className="diamonds"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    >
                      {diamonds()}
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
                            +{bonus(tile.level)} {bonusTypeIcon}
                          </div>
                          <div>per year</div>
                        </div>
                      </div>
                    )}

                    <div></div>

                    <div className="big-icon-hint">
                      <div>{tile.defence}🛡️</div>
                      <div>defence</div>
                    </div>
                  </div>
                </div>
              )}

              {!tile.owner && (
                <div className="tile-card-base-info">
                  <div className="tile-card-base-row">
                    <div>
                      <div style={cantAfford ? { color: '#ff4444' } : undefined}>
                        {cantAfford ? "can't afford" : '👛 to own:'}
                      </div>
                      <div>
                        <div>
                          <span
                            style={
                              activePlayer &&
                              (activePlayer.gold ?? 0) < (tile.currentPrice.gold ?? 0)
                                ? { color: '#ff4444' }
                                : {}
                            }
                          >
                            {activePlayer &&
                              (activePlayer.gold ?? 0) < (tile.currentPrice.gold ?? 0) &&
                              '🔻'}
                            {tile.currentPrice.gold ?? 0} 🟡
                          </span>
                          {'  '}
                          <span
                            style={
                              activePlayer &&
                              (activePlayer.units ?? 0) < (tile.currentPrice.units ?? 0)
                                ? { color: '#ff4444' }
                                : {}
                            }
                          >
                            {activePlayer &&
                              (activePlayer.units ?? 0) < (tile.currentPrice.units ?? 0) &&
                              '🔻'}
                            {tile.currentPrice.units ?? 0}🧍
                          </span>
                          {tile.requiredFame > 0 && (
                            <>
                              {'  '}
                              <span
                                style={
                                  activePlayer && (activePlayer.fame ?? 1) < tile.requiredFame
                                    ? { color: '#ff4444' }
                                    : {}
                                }
                              >
                                {activePlayer &&
                                  (activePlayer.fame ?? 1) < tile.requiredFame &&
                                  '🔻'}
                                {tile.requiredFame} 🏆
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      {couldBuy &&
                        tile.isAffordable(
                          activePlayer?.gold ?? 0,
                          activePlayer?.units ?? 0,
                          activePlayer?.fame ?? 1
                        ) && (
                          <button className="game-menu-button" onClick={(e) => handleBuyClick(e)}>
                            Buy
                          </button>
                        )}
                    </div>
                  </div>
                  <div className="tile-card-base-row">
                    <div className="big-icon-hint">
                      +{bonus(tile.level)} {bonusTypeIcon}
                      <div>per year</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {expanded && (
              <div className="tile-card-table-wrap">
                <table className="tile-card-table">
                  <tbody>
                    <tr
                      className={
                        mode === 'owned' && currentLevel > 1 ? 'upgrade-unreachable' : undefined
                      }
                    >
                      <td className={class1}>{priceCell(1)}</td>
                      <td className={class1}>
                        +{bonus(1)} {bonusTypeIcon}
                      </td>
                      <td className={class1}>{defence(1)}🛡️ </td>
                    </tr>
                    <tr
                      className={
                        mode === 'owned' && currentLevel > 2 ? 'upgrade-unreachable' : undefined
                      }
                    >
                      <td className={class2}>{priceCell(2)}</td>
                      <td className={class2}>
                        +{bonus(2)} {bonusTypeIcon}
                      </td>
                      <td className={class2}>{defence(2)}🛡️ </td>
                    </tr>
                    <tr
                      className={
                        mode === 'owned' && upgradeUnreachable ? 'upgrade-unreachable' : undefined
                      }
                    >
                      <td className={class3}>{priceCell(3)}</td>
                      <td className={class3}>
                        +{bonus(3)} {bonusTypeIcon}
                      </td>
                      <td className={class3}>{defence(3)}🛡️ </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {expanded && mode === 'owned' && (
              <div className="tile-card-sell" style={{ marginTop: '1rem' }}>
                <div onClick={() => handleSell()} className={'tile-card-button'}>
                  🪙 sell
                </div>
              </div>
            )}
          </div>

          <div className="upgrade-row">
            {mode === 'owned' && !maxLevelReached && (
              <div
                className="tile-card-actions"
                style={{ backgroundColor: tile.groupColor + '4f' }}
              >
                <div
                  onClick={() => (canUpgrade ? handleUpgrade() : handleInfoClick())}
                  className={'tile-card-button' + (canUpgrade ? '' : ' disabled')}
                >
                  <div className="big-icon-hint">
                    <div>⬆️</div>
                    <div className="upgrade-diamonds">{diamonds(nextLevel)}</div>
                  </div>

                  <div>
                    +{nextLevelBonus}
                    {bonusTypeIcon}
                  </div>
                  <div>{nextLevelDefence}🛡️</div>
                </div>
              </div>
            )}
          </div>
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
