import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { PlayerLabel } from './PlayerLabel';
import { DecoratedButton } from './DecoratedButton';
import { fmtPrice } from './TileCard';
import { clearScreen } from '../utils/screenStore';
import { say } from '../utils/say';
import { setTileGarrison } from '../actions/garrisonTile';
import { sellTile } from '../actions/sellTile';
import { yieldTile, takeTileBack, takeBackCost } from '../actions/yieldTile';
import { remainingCapacity } from '../game/army';
import { getCharacterConfig } from '../ai/decisions';
import { useT } from '../i18n';
import { tJsx } from '../i18n/tJsx';
import '../styles/TileCard.css';
import '../styles/GameMenu.css';

interface TileInfoScreenProps {
  tile: Tile;
  player: Player;
  gameState: GameState;
  updateGameState: (board: GameState) => void;
  /** 'claimed' is shown right after claiming an undefended/won tile (fame
   * line, bot auto-garrison); 'upgrades' is the general-purpose view opened
   * by clicking an owned tile (no fame line, adds sell/yield). */
  variant: 'claimed' | 'upgrades';
}

export const TileInfoScreen: React.FC<TileInfoScreenProps> = ({
  tile,
  player,
  gameState,
  updateGameState,
  variant,
}) => {
  const t = useT();
  const bonusTypeIcon = tile.bonusType === 'units' ? '👬' : '🟡';

  // garrisonAmount is an ABSOLUTE target headcount, not a delta — so the
  // pool it's bounded by is everything this player controls, whether
  // already garrisoned here or still traveling with them, not just
  // player.militia (which already excludes whatever's currently garrisoned).
  const totalMilitiaPool = player.militia + tile.garrisonMilitia;
  const maxGarrison = Math.min(
    tile.garrisonMilitia + remainingCapacity(tile.garrisonMilitia, tile.garrisonRiders, tile.garrisonSlots, 'militia'),
    totalMilitiaPool
  );
  // Decreasing an existing garrison is only allowed while physically
  // standing on the tile — increasing it is always allowed.
  // onBuy/onSell-style mutations below act directly on `tile`/`player` in
  // place, but this screen is a static `content:` element handed to
  // screenStore once at mount — nothing else re-invokes it, so force a
  // re-render after any mutation that doesn't already close the screen
  // (mirrors TavernModal/KingsCastleModal).
  const [, forceRerender] = useState(0);

  const canDecreaseGarrison = gameState.activeTile === tile;
  // Default to whatever's already garrisoned, if anything — only fall back
  // to proposing half the pool for a tile that isn't guarded yet.
  const [garrisonAmount, setGarrisonAmount] = useState(() =>
    tile.garrisonMilitia > 0
      ? Math.min(maxGarrison, tile.garrisonMilitia)
      : Math.min(maxGarrison, Math.floor(totalMilitiaPool / 2))
  );

  const applyGarrison = (newValue: number) => {
    const clamped = Math.min(maxGarrison, Math.max(0, newValue));
    if (clamped < tile.garrisonMilitia && !canDecreaseGarrison) {
      say(t('tileCard.garrisonWarning'), 'warning');
      return;
    }
    setGarrisonAmount(clamped);
  };

  useEffect(() => {
    if (variant !== 'claimed' || !player.isComputer) return;
    const fraction = getCharacterConfig(player)?.claimGarrisonFraction ?? 0;
    const amount = Math.min(maxGarrison, Math.floor(fraction * totalMilitiaPool));
    const timer = setTimeout(() => {
      if (amount > 0) {
        setTileGarrison(gameState, player, tile, amount);
        updateGameState(gameState);
      }
      clearScreen();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const handleSetGarrison = () => {
    setTileGarrison(gameState, player, tile, garrisonAmount);
    updateGameState(gameState);
    clearScreen();
  };

  const currentLevel = tile.level || 1;
  const maxLevel = 3;
  const nextLevel = Math.min(currentLevel + 1, maxLevel);

  const canUpgradeToLevel = (level: number): boolean =>
    !tile.isYielded &&
    level === nextLevel &&
    currentLevel < maxLevel &&
    !!tile.prices[level] &&
    (player.gold ?? 0) >= (tile.prices[level].gold || 0);

  const handleUpgradeToLevel = (level: number) => {
    if (!canUpgradeToLevel(level)) return;
    const price = tile.prices[level];
    if (!window.confirm(t('tileCard.confirmUpgrade', { tileName: tile.name, gold: price.gold }))) return;

    player.gold = (player.gold || 0) - (price.gold || 0);
    tile._level = level;
    say(t('tileCard.upgradedMessage', { playerName: player.name, tileName: tile.name, level }), 'info');
    updateGameState(gameState);
    forceRerender((v) => v + 1);
  };

  const priceTag = (level: number) => (
    <span
      className={'upgrade-price-badge' + (canUpgradeToLevel(level) ? ' clickable' : '')}
      onClick={() => handleUpgradeToLevel(level)}
    >
      👛 {tile.prices[level]?.gold ?? 0}🟡
    </span>
  );

  const sellPrice = tile.isYielded
    ? { gold: Math.floor(tile.currentPrice.gold * 0.4), units: Math.floor(tile.currentPrice.units * 0.4) }
    : tile.currentPrice;

  const handleSell = () => {
    if (
      !window.confirm(
        t('tileCard.confirmSell', { tileName: tile.name, price: fmtPrice(sellPrice.gold, sellPrice.units, t('common.and')) })
      )
    )
      return;

    const refunds = sellTile(gameState, player, tile);
    updateGameState(gameState);
    say(
      t('tileCard.soldMessage', { playerName: player.name, tileName: tile.name, gold: refunds.gold, units: refunds.units }),
      'info'
    );
    clearScreen();
  };

  const handleYieldToggle = () => {
    if (tile.isYielded) {
      const cost = takeBackCost(tile);
      if (player.gold < cost) {
        say(t('yieldTile.cannotAfford', { gold: cost, tileName: tile.name }), 'error');
        return;
      }
      if (!window.confirm(t('tileCard.confirmTakeBack', { tileName: tile.name, gold: cost }))) return;
      takeTileBack(gameState, player, tile);
    } else {
      const refund = Math.floor(tile.currentPrice.gold / 2);
      if (!window.confirm(t('tileCard.confirmYield', { tileName: tile.name, gold: refund }))) return;
      yieldTile(gameState, player, tile);
    }
    updateGameState(gameState);
    forceRerender((v) => v + 1);
  };

  return (
    <ScreenBackground image="assets/screens/victory.jpg" style={{paddingTop: '1rem'}}>
      <Fade />
      {variant === 'upgrades' && (
        <button
          onClick={() => clearScreen()}
          className="tile-card-close"
          style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '16px', filter: 'grayscale(100%)', opacity: 0.7 }}
        >
          ❌
        </button>
      )}
      {tile.spriteImage && <SpriteCircleIcon src={tile.spriteImage} size='5rem'/>}
      <div className="text-title" style={{ marginBottom: '0'}}>{tile.name}</div>

      <div className="text-message" style={{lineHeight: '1.2', whiteSpace: 'pre-line'}}>
        {variant === 'claimed'
          ? tJsx('tileClaimScreen.claimedBy', {
              player: <PlayerLabel player={player} bold />,
              fame: <>🏆{player.fame}</>,
            })
          : tJsx('tileClaimScreen.belongsTo', { player: <PlayerLabel player={player} bold /> })}
      </div>

      {variant === 'upgrades' && (
        <div
          className="tile-card-sell"
          style={{ marginTop: '1rem', marginLeft: 'auto', marginRight: 'auto', position: 'relative', zIndex: 6002 }}
        >
          <div onClick={handleYieldToggle} className="tile-card-button tile-card-sell-item">
            🏦 {tile.isYielded ? t('tileCard.takeBack') : t('tileCard.yieldToKing')}
          </div>
          <div onClick={handleSell} className="tile-card-button tile-card-sell-item">
            🪙 {t('tileCard.sell')}
          </div>
        </div>
      )}

      <div className="text-message tile-card-table-wrap" style={{ marginTop: '3rem' }}>
        <div className="tile-card-table" style={{fontSize: '1.1rem', fontFamily: 'Encode', color: 'wheat'}}>
                <div className="tc-td" style={{textAlign:'center'}}>
                  {tJsx('tileClaimScreen.currentLevelLine', {
                    slots: <span className="value">{currentLevel}</span>,
                    bonus: <span className="value">{tile.bonuses[currentLevel] ?? 0}</span>,
                    icon: bonusTypeIcon,
                  })}
                </div>
                {currentLevel < 2 && (
                  <div className="tc-td" style={{paddingTop: '0.5rem', fontSize: '1rem'}}>
                      {tJsx('tileClaimScreen.upgradeLine', {
                        priceTag: priceTag(2),
                        slots: <span className="value">2</span>,
                        bonus: <span className="value">{tile.bonuses[2] ?? 0}</span>,
                        icon: bonusTypeIcon,
                      })}
                  </div>
                )}
                {currentLevel < 3 && (
                  <div
                    className={'tc-td' + (nextLevel !== 3 ? ' upgrade-unreachable' : '')}
                    style={{fontSize: '1rem'}}
                  >
                      {tJsx('tileClaimScreen.upgradeLine', {
                        priceTag: priceTag(3),
                        slots: <span className="value">3</span>,
                        bonus: <span className="value">{tile.bonuses[3] ?? 0}</span>,
                        icon: bonusTypeIcon,
                      })}
                  </div>
                )}
                {totalMilitiaPool > 0 && !tile.isYielded && (
                  <div className="tc-td" style={{paddingTop: '1.5rem', textAlign: 'center'}}>
                    {t('tileClaimScreen.onGuard')}
                    <div className="units-input-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                      {tJsx('tileClaimScreen.onGuardLine', {
                        slots: <span className="value">{tile.garrisonSlots}</span>,
                        input: (
                          <input
                            type="number"
                            value={garrisonAmount}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              applyGarrison(Number.isNaN(parsed) ? 0 : parsed);
                            }}
                            min="0"
                            max={maxGarrison}
                            id="garrisonInput"
                            className="units-input"
                          />
                        ),
                      })}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                        <button
                          className="game-menu-button silver"
                          onClick={() => applyGarrison(garrisonAmount - 1)}
                        >
                          −
                        </button>
                        <button
                          className="game-menu-button silver"
                          onClick={() => applyGarrison(Math.min(maxGarrison, Math.floor(totalMilitiaPool / 2)))}
                        >
                          {Math.min(maxGarrison, Math.floor(totalMilitiaPool / 2))}🧍
                        </button>
                        <button
                          className="game-menu-button silver"
                          onClick={() => applyGarrison(garrisonAmount + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      {(() => {
                        const stayingMilitia = totalMilitiaPool - garrisonAmount;
                        const stayingRiders = player.riders;
                        if (stayingMilitia > 0 && stayingRiders > 0) {
                          return t('tileClaimScreen.stayInArmyBoth', { count: stayingMilitia, riders: stayingRiders });
                        }
                        if (stayingRiders > 0) {
                          return t('tileClaimScreen.stayInArmyRidersOnly', { riders: stayingRiders });
                        }
                        return t('tileClaimScreen.stayInArmy', { count: stayingMilitia });
                      })()}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      {t('tileClaimScreen.garrisonVisitCaveat')}
                    </div>
                  </div>
                )}
        </div>
      </div>

      <div className="game-menu" style={{ top: '1rem' }}>
        <div>
          {tile.isYielded ? (
            <DecoratedButton onClick={() => clearScreen()}>
              {t('tileClaimScreen.kingSeesTheWay')}
            </DecoratedButton>
          ) : (
            <DecoratedButton onClick={handleSetGarrison}>
              {garrisonAmount === 0 ? t('tileClaimScreen.leaveUnguarded') : t('tileClaimScreen.setToGuard', { amount: garrisonAmount })}
            </DecoratedButton>
          )}
        </div>
      </div>
    </ScreenBackground>
  );
};

interface TileClaimScreenProps {
  tile: Tile;
  player: Player;
  gameState: GameState;
  updateGameState: (board: GameState) => void;
}

export const TileClaimScreen: React.FC<TileClaimScreenProps> = (props) => (
  <TileInfoScreen {...props} variant="claimed" />
);

export default TileClaimScreen;
