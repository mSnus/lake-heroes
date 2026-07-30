import React from 'react';
import { Tile } from '../game/Tile';
import '../styles/TileCard.css';
import { say } from '../utils/say';
import { GameState } from '../game/GameState';
import { sellTile } from '../actions/sellTile';
import { claimTile } from '../actions/claimTile';
import { setTileGarrison } from '../actions/garrisonTile';
import { gameEvent } from '../utils/events';
import { SPRITE_SIZE } from '../game/constants';
import { syndicateMultiplier } from '../game/syndicate';
import { BRAWL_THRESHOLD } from '../game/constants';
import { isBrawlMatchup } from '../actions/battles/common';
import DecoratedButton from './DecoratedButton';

const fmtPrice = (gold: number, units: number, join: string = ''): string => {
  const hasGold = gold > 0;
  const hasUnits = units > 0;
  join = join ? ` ${join} ` : '';

  if (hasGold && hasUnits) return `${gold}🟡${join}${units}🧍`;
  if (hasGold) return `${gold}🟡`;
  if (hasUnits) return `${units}🧍`;
  return '0';
};

// Upgrades only ever cost gold now (see priceCell) — slots are what levels
// grant instead of a computed defence number, and slots == level by design.
const slotsAtLevel = (level: number): number => level;

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
  defaultExpanded?: boolean;
  demoMode?: boolean;
};

export const TileCard: React.FC<TileCardProps> = ({
  tile,
  mode = 'display',
  gameState,
  updateGameState,
  couldBuy = false,
  defaultExpanded = false,
  demoMode = false,
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  if (!tile || !tile.name) return null;

  const groupColor = tile.groupColor;
  const ownerPlayer = gameState?.players.find((p) => p.id === tile.owner) ?? null;

  // Syndicate: the owner holds every ownable tile of this group, which doubles
  // the income bonus.
  const syndicateMult =
    gameState && ownerPlayer ? syndicateMultiplier(gameState, ownerPlayer, tile.group) : 1;
  const isSyndicate = syndicateMult > 1;

  const bonusType = getBonusType(tile);

  // Price cell for the level breakdown table. Upgrades only cost gold. On the
  // upgrade-target row of an owned tile that the player can't afford, it's
  // shown bold red with a 🔻 prefix (same treatment as the "can't own" case).
  const priceCell = (level: number) => {
    const gold = tile.prices[level]?.gold ?? 0;
    const isOwnedByActive = mode === 'owned' && tile.owner === activePlayer?.id;
    const isUpgradeTarget = isOwnedByActive && level === nextLevel && !maxLevelReached;
    const lacksGold = !!isUpgradeTarget && !!activePlayer && (activePlayer.gold ?? 0) < gold;
    const redBold = { color: '#ff4444', fontWeight: 'bold' as const };

    if (gold <= 0) return <>0</>;

    let icon = 'ᅠ';

    if (lacksGold) {
      icon = '❌ ';
    } else if (isUpgradeTarget) {
      icon = '⬆️ ';
    }

    return (
      <>
        <span>{icon}</span>
        {level > currentLevel ? '+' : ' '}
        <span style={lacksGold ? redBold : undefined}>
          {lacksGold && '🔻'}
          {gold}🟡
        </span>
      </>
    );
  };

  const bonus = (level: number) => (tile.bonuses[level] ?? 0) * syndicateMult;
  const defence = (level: number) => tile.getDefence(level);

  const bonusTypeIcon = bonusType === 'gold' ? '🟡' : '👬';

  const class1 = tile.isOwned() && tile.level < 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class2 = tile.isOwned() && tile.level == 2 ? 'tc-td level-highlighted' : 'tc-td';
  const class3 = tile.isOwned() && tile.level == 3 ? 'tc-td level-highlighted' : 'tc-td';

  const activePlayer = gameState?.activePlayer ?? null;

  // Brawl tiles (low defence) always require enough units to win the
  // winner-take-all round — but only when the attacker's own army is also
  // small; a big army attacking a weak tile fights a normal battle instead
  // (mirrors BattleScreen's isBrawl rule). Above the brawl threshold, an
  // attacker with more than BRAWL_THRESHOLD units may "banzai" — attack
  // despite having fewer units than the tile's defence — as a deliberate gamble.
  const lvl1Defence = defence(1);
  const attackerPower = activePlayer?.armyPower ?? 0;
  const isBrawlTile = isBrawlMatchup(lvl1Defence, attackerPower);
  const isBanzai =
    !isBrawlTile &&
    !!activePlayer &&
    attackerPower > BRAWL_THRESHOLD &&
    attackerPower < lvl1Defence;
  const attackEmoji = isBrawlTile ? '✊' : isBanzai ? '🩸' : '⚔️';
  const unitsInsufficient = !isBanzai && !!activePlayer && attackerPower < lvl1Defence;

  const cantAfford =
    (activePlayer && (activePlayer.gold ?? 0) < (tile.currentPrice.gold ?? 0)) ||
    unitsInsufficient ||
    (tile.requiredFame > 0 && activePlayer && (activePlayer.fame ?? 1) < tile.requiredFame);

  const isOnFire = tile.isOnFire(gameState?.round ?? 0);

  const currentLevel = tile.level || 1;
  const maxLevel = 3;
  const nextLevel = Math.min(currentLevel + 1, maxLevel);
  const nextLevelBonus = bonus(nextLevel);
  const maxLevelReached = currentLevel >= maxLevel;

  const canUpgrade =
    activePlayer &&
    currentLevel < maxLevel &&
    tile.prices &&
    tile.prices[currentLevel + 1] &&
    (activePlayer.gold ?? 0) >= (tile.prices[currentLevel + 1].gold || 0);

  const upgradeUnreachable = !canUpgrade || currentLevel === 1;

  const prices = tile.prices || {};
  const nextPrice = prices[nextLevel];

  const sellPrice = tile.currentPrice;

  const handleUpgrade = () => {
    if (demoMode) return;

    if (!window.confirm(`Really upgrade ${tile.name} for ${nextPrice.gold}🟡?`)) return;

    if (!nextPrice || !activePlayer || !gameState) return;

    if ((activePlayer.gold || 0) < (nextPrice.gold || 0)) {
      return;
    }

    gameState.players[gameState.playerOrder[gameState.activePlayerIndex]].gold =
      (activePlayer.gold || 0) - (nextPrice.gold || 0);
    tile._level = nextLevel;
    say(`${activePlayer.name} upgraded ${tile.name} to level ${nextLevel}`, 'info');
    updateGameState && updateGameState(gameState);
  };

  const handleClose = () => {
    if (demoMode) return;

    gameEvent('displayTile', {});
  };

  const handleSell = () => {
    if (demoMode) return;

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

  const handleGarrison = () => {
    if (demoMode) return;
    if (!gameState || !updateGameState || !activePlayer) return;

    const militiaInput = window.prompt(
      `Militia to garrison at ${tile.name}? (${activePlayer.militia}🧍 traveling, ${tile.garrisonMilitia}🧍 already here, ${tile.garrisonSlots} slot${tile.garrisonSlots === 1 ? '' : 's'} of 10 here)`,
      String(tile.garrisonMilitia)
    );
    if (militiaInput === null) return;
    const targetMilitia = parseInt(militiaInput, 10);
    if (Number.isNaN(targetMilitia) || targetMilitia < 0) return;

    let targetRiders = tile.garrisonRiders;
    if (activePlayer.isKnight) {
      const ridersInput = window.prompt(
        `Riders to garrison at ${tile.name}? (${activePlayer.riders}🐎 traveling, ${tile.garrisonRiders}🐎 already here)`,
        String(tile.garrisonRiders)
      );
      if (ridersInput === null) return;
      const parsed = parseInt(ridersInput, 10);
      if (Number.isNaN(parsed) || parsed < 0) return;
      targetRiders = parsed;
    }

    setTileGarrison(gameState, activePlayer, tile, targetMilitia, targetRiders);
    updateGameState(gameState);
  };

  const upgradeRowProps = (level: number) =>
    mode === 'owned' && canUpgrade && level === nextLevel
      ? { onClick: handleUpgrade, style: { cursor: 'pointer' as const } }
      : {};

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gameState || !updateGameState) return;

    claimTile(gameState, updateGameState);
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

        {mode === 'display' && !demoMode && (
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
                    {tile.owner !== activePlayer?.id && (
                      <div>
                        <div className="big-icon-hint">
                          <div>{tile.fee}🟡</div>
                          <div>fee</div>
                        </div>
                      </div>
                    )}

                    {tile.owner === activePlayer?.id && (
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

                    <div
                      className="big-icon-hint"
                      onClick={(e) => {
                        if (tile.owner !== activePlayer?.id) return;
                        e.stopPropagation();
                        handleGarrison();
                      }}
                      style={tile.owner === activePlayer?.id ? { cursor: 'pointer' } : undefined}
                    >
                      <div>
                        {tile.garrisonSlots}🏯 {tile.garrison}🛡️
                      </div>
                      <div>defence</div>
                    </div>
                  </div>
                </div>
              )}

              {!tile.owner && (
                <div className="tile-card-base-info">
                  <div className="tile-card-base-row">
                    <div className="big-icon-hint">
                      +{bonus(tile.level)} {bonusTypeIcon}
                      <div>per year</div>
                    </div>
                  </div>

                  <div className="tile-card-base-row">
                    <div>
                      <div style={cantAfford ? { color: '#ff4444' } : undefined}>
                        {cantAfford ? "can't afford" : 'to own:'}
                      </div>
                      <div>
                        <div>
                          {tile.requiredFame > 0 && (
                            <>
                              <span
                                style={
                                  activePlayer && (activePlayer.fame ?? 1) < tile.requiredFame
                                    ? { color: '#ff4444', marginRight: '8px' }
                                    : { marginRight: '8px' }
                                }
                              >
                                {activePlayer &&
                                  (activePlayer.fame ?? 1) < tile.requiredFame &&
                                  '🔻'}
                                🏆{tile.requiredFame}
                              </span>
                              {'  '}
                            </>
                          )}

                          <span
                            style={
                              activePlayer &&
                              (activePlayer.gold ?? 0) < (tile.currentPrice.gold ?? 0)
                                ? { color: '#ff4444' }
                                : {}
                            }
                          >
                            {activePlayer &&
                            (activePlayer.gold ?? 0) < (tile.currentPrice.gold ?? 0)
                              ? '🔻'
                              : '👛 '}
                            {tile.currentPrice.gold ?? 0}🟡
                          </span>
                          {'  '}

                          <span style={unitsInsufficient ? { color: '#ff4444' } : undefined}>
                            {unitsInsufficient && '🔻'}
                            {defence(1)}
                            🛡️
                          </span>
                        </div>
                      </div>
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
                      {...upgradeRowProps(1)}
                    >
                      <td className={class1}>base</td>
                      <td className={class1}>→</td>
                      <td className={class1}>
                        +{bonus(1)} {bonusTypeIcon}
                      </td>
                      <td className={class1}>{slotsAtLevel(1)}🏯 </td>
                    </tr>
                    <tr
                      className={
                        mode === 'owned' && currentLevel > 2 ? 'upgrade-unreachable' : undefined
                      }
                      {...upgradeRowProps(2)}
                    >
                      <td className={class2}>{priceCell(2)}</td>
                      <td className={class2}>→</td>
                      <td className={class2}>
                        +{bonus(2)} {bonusTypeIcon}
                      </td>
                      <td className={class2}>{slotsAtLevel(2)}🏯 </td>
                    </tr>
                    <tr
                      className={
                        mode === 'owned' && upgradeUnreachable ? 'upgrade-unreachable' : undefined
                      }
                      {...upgradeRowProps(3)}
                    >
                      <td className={class3}>{priceCell(3)}</td>
                      <td className={class3}>→</td>
                      <td className={class3}>
                        +{bonus(3)} {bonusTypeIcon}
                      </td>
                      <td className={class3}>{slotsAtLevel(3)}🏯 </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {expanded && (mode === 'owned' || demoMode) && (
              <div className="tile-card-sell" style={{ marginTop: '1rem', display: 'flex', gap: '8px' }}>
                <div onClick={() => handleSell()} className={'tile-card-button'}>
                  🪙 sell
                </div>
              </div>
            )}
          </div>

          <div className="upgrade-row">
            {((mode === 'owned' && !maxLevelReached) || demoMode) && (
              <div
                className="tile-card-actions"
                style={{ backgroundColor: tile.groupColor + '4f' }}
              >
                <div
                  onClick={() => (canUpgrade ? handleUpgrade() : handleInfoClick())}
                  className={'tile-card-button' + (canUpgrade || demoMode ? '' : ' disabled')}
                >
                  <div className="big-icon-hint">
                    <div>⬆️</div>
                  </div>

                  <div>
                    +{nextLevelBonus}
                    {bonusTypeIcon}
                  </div>
                  <div>{slotsAtLevel(nextLevel)}🏯</div>
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

      {!tile.owner && (
        <div>
          {couldBuy && isOnFire && (
            <div className="tile-card-onfire" style={{ textAlign: 'center', padding: '8px' }}>
              🔥 still smoldering — claimable next round
            </div>
          )}
          {couldBuy &&
            tile.isAffordable(
              activePlayer?.gold ?? 0,
              activePlayer?.armyPower ?? 0,
              activePlayer?.fame ?? 1,
              gameState?.round ?? 0
            ) && (
              <DecoratedButton
                onClick={(e) => handleBuyClick(e)}
                style={{
                  width: '100%',
                  marginBottom: '0',
                  height: '80px',
                  paddingBottom: '8px',
                  filter: 'drop-shadow(2px 2px 3px #00000050)',
                }}
              >
                {isBanzai ? 'Banzai! ' : 'Claim it! '}
                {attackEmoji}
                {Math.round(attackerPower)} <span style={{ fontSize: '0.9rem' }}>vs</span>{' '}
                {defence(1)}
              </DecoratedButton>
            )}
        </div>
      )}
    </div>
  );
};

export default TileCard;
