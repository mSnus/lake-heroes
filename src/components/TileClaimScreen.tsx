import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { PlayerLabel } from './PlayerLabel';
import { DecoratedButton } from './DecoratedButton';
import { DecoratedSlider } from './DecoratedSlider';
import { fmtPrice } from './TileCard';
import { clearScreen } from '../utils/screenStore';
import { say } from '../utils/say';
import { setTileGarrison } from '../actions/garrisonTile';
import { sellTile } from '../actions/sellTile';
import { yieldTile, takeTileBack, takeBackCost } from '../actions/yieldTile';
import { remainingCapacity } from '../game/army';
import { tileTurnIncome } from '../game/income';
import { TOWER_LEVEL_GOLD_BONUS } from '../game/constants';
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

  // Per-turn income at a given level (not necessarily the tile's current
  // one -- levels 2/3 preview an upgrade not yet taken), same combined
  // gold+units format as TileCard's own preview.
  const turnIncomeLabel = (level: number) => {
    const income = tileTurnIncome(tile, 1, level);
    return (
      <>
        {income.gold > 0 && <>+{income.gold}🟡 </>}
        {income.units > 0 && <>+{income.units} 👬</>}
      </>
    );
  };

  // Towers' fortification toll (see game/kingsGrace.ts's computeAnnualReward)
  // only pays out once a lap, not every turn like the rest of a tile's
  // income -- shown as its own "per year" block alongside the per-turn one.
  const isTower = tile.group === 'Towers';
  const towerYearlyLabel = (level: number) => <>+{TOWER_LEVEL_GOLD_BONUS * level}🟡</>;

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

  // Live value while the slider is being dragged, before it's actually
  // applied (and validated) on release -- null when not dragging, so the
  // labels fall back to the real committed garrisonAmount.
  const [previewGarrison, setPreviewGarrison] = useState<number | null>(null);
  const displayedGarrison = previewGarrison ?? garrisonAmount;

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

  const priceTag = (level: number) => {
    const gold = tile.prices[level]?.gold ?? 0;
    const clickable = canUpgradeToLevel(level);
    // The upgrade-target level the player can't afford gets the same "can't
    // pay" treatment as TileCard's upgrade table: ❌ instead of 👛, a 🔻
    // prefix, and bold red price text (see TileCard.priceCell).
    const isUpgradeTarget = !tile.isYielded && level === nextLevel && currentLevel < maxLevel;
    const lacksGold = isUpgradeTarget && (player.gold ?? 0) < gold;
    return (
      <span
        className={'upgrade-price-badge' + (clickable ? ' clickable' : '')}
        onClick={clickable ? () => handleUpgradeToLevel(level) : undefined}
      >
        {lacksGold ? '❌' : '👛'}{' '}
        <span style={lacksGold ? { color: '#ff4444', fontWeight: 'bold' } : undefined}>
          {lacksGold && '🔻'}
          {gold}🟡
        </span>
      </span>
    );
  };

  // The garrison itself always comes back in full on sale, yielded or not --
  // only the gold refund takes the yield penalty (see sellTile.ts).
  const sellPrice = tile.isYielded
    ? { gold: Math.floor(tile.currentPrice.gold * 0.4), units: Math.floor(tile.currentPrice.units) }
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
          style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '16px', filter: 'grayscale(100%)', opacity: 0.8, zIndex: 6002 }}
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
                <div
                  className="tc-td"
                  style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {tJsx('tileClaimScreen.currentLevelLine', {
                    slots: <span className="value">{currentLevel}</span>,
                  })}
                  <div className="big-icon-hint">
                    <div>{turnIncomeLabel(currentLevel)}</div>
                    <div>{t('tileCard.perTurn')}</div>
                  </div>
                  {isTower && (
                    <div className="big-icon-hint">
                      <div>{towerYearlyLabel(currentLevel)}</div>
                      <div>{t('tileCard.perYear')}</div>
                    </div>
                  )}
                </div>
                {currentLevel < 2 && (
                  <div
                    className="tc-td"
                    style={{ paddingTop: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                      {tJsx('tileClaimScreen.upgradeLine', {
                        priceTag: priceTag(2),
                        slots: <span className="value">2</span>,
                        bonusBlock: (
                          <div className="big-icon-hint">
                            <div>{turnIncomeLabel(2)}</div>
                            <div>{t('tileCard.perTurn')}</div>
                          </div>
                        ),
                      })}
                      {isTower && (
                        <div className="big-icon-hint">
                          <div>{towerYearlyLabel(2)}</div>
                          <div>{t('tileCard.perYear')}</div>
                        </div>
                      )}
                  </div>
                )}
                {currentLevel < 3 && (
                  <div
                    className={'tc-td' + (nextLevel !== 3 ? ' upgrade-unreachable' : '')}
                    style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                      {tJsx('tileClaimScreen.upgradeLine', {
                        priceTag: priceTag(3),
                        slots: <span className="value">3</span>,
                        bonusBlock: (
                          <div className="big-icon-hint">
                            <div>{turnIncomeLabel(3)}</div>
                            <div>{t('tileCard.perTurn')}</div>
                          </div>
                        ),
                      })}
                      {isTower && (
                        <div className="big-icon-hint">
                          <div>{towerYearlyLabel(3)}</div>
                          <div>{t('tileCard.perYear')}</div>
                        </div>
                      )}
                  </div>
                )}
                {totalMilitiaPool > 0 && !tile.isYielded && (
                  <div className="tc-td" style={{ paddingTop: '1.5rem', textAlign: 'center' }}>
                    {t('tileClaimScreen.onGuard')}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        marginTop: '0.5rem',
                      }}
                    >
                      <div className="big-icon-hint">
                        <div>
                          {tile.garrisonSlots}🏯 {displayedGarrison}🧍
                        </div>
                        <div>{t('tileCard.defence')}</div>
                      </div>
                      <DecoratedSlider
                        min={0}
                        max={maxGarrison}
                        value={displayedGarrison}
                        onPreview={setPreviewGarrison}
                        onCommit={(v) => {
                          applyGarrison(v);
                          setPreviewGarrison(null);
                        }}
                      />
                      <div className="big-icon-hint">
                        <div>{totalMilitiaPool - displayedGarrison}🧍🚩</div>
                        <div>{t('tileClaimScreen.army')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' }}>
                      {t('tileClaimScreen.garrisonVisitCaveat')}
                    </div>
                  </div>
                )}
        </div>
      </div>

      <div className="game-menu">
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
