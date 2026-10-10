import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { DecoratedButton } from './DecoratedButton';
import { DecoratedSlider } from './DecoratedSlider';
import { fmtPrice } from './TileCard';
import { clearScreen } from '../utils/screenStore';
import { say, sayLocal } from '../utils/say';
import { setTileGarrison } from '../actions/garrisonTile';
import { sellTile } from '../actions/sellTile';
import { yieldTile, takeTileBack, takeBackCost } from '../actions/yieldTile';
import { remainingCapacity, garrisonSlotCapacity } from '../game/army';
import { tileTurnIncome } from '../game/income';
import { useT } from '../i18n';
import { tJsx } from '../i18n/tJsx';
import '../styles/TileCard.css';
import '../styles/TileClaim.css';
import '../styles/GameMenu.css';
import { planClaimGarrison } from '../ai/botPlans';

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
    const income = tileTurnIncome(tile, 1, level, gameState, player);
    return (
      <>
        {income.gold > 0 && <>+{income.gold}🟡 </>}
        <br/>
        {income.units > 1 && <>+{income.units}🧍</>}
      </>
    );
  };

  // Some units-type tiles' (Camps/Towers) extra per-level toll (see
  // game/kingsGrace.ts's computeAnnualReward) only pays out once a lap, not
  // every turn like the rest of a tile's income -- shown as its own "per
  // year" block alongside the per-turn one.
  const isTower = Object.values(tile.annualUnits).some((v) => v > 0);
  const towerYearlyLabel = (level: number) => <>+{tile.annualUnits[level] ?? 0}👬</>;

  // garrisonAmount is an ABSOLUTE target headcount, not a delta — so the
  // pool it's bounded by is everything this player controls, whether
  // already garrisoned here or still traveling with them, not just
  // player.militia (which already excludes whatever's currently garrisoned).
  const totalMilitiaPool = player.militia + tile.garrisonMilitia;
  const maxGarrison = Math.min(
    tile.garrisonMilitia +
      remainingCapacity(
        tile.garrisonMilitia,
        tile.garrisonRiders,
        tile.garrisonSlots,
        'militia',
        garrisonSlotCapacity()
      ),
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
      sayLocal(t('tileCard.garrisonWarning'), 'warning');
      return;
    }

    setGarrisonAmount(clamped);
  };

  // Live value while the slider is being dragged, before it's actually
  // applied (and validated) on release -- null when not dragging, so the
  // labels fall back to the real committed garrisonAmount.
  const [previewGarrison, setPreviewGarrison] = useState<number | null>(null);
  const displayedGarrison = previewGarrison ?? garrisonAmount;
  const defenceCapacity = (level: number) => garrisonSlotCapacity() * level;

  useEffect(() => {
    if (variant !== 'claimed' || !player.isComputer) return;
    const amount = planClaimGarrison(player, maxGarrison, totalMilitiaPool);
    const timer = setTimeout(() => {
      if (amount > 0) {
        setTileGarrison(gameState, player, tile, amount);
        updateGameState(gameState);
      }

      clearScreen();
    }, 800);
    return () => clearTimeout(timer);
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
    (player.gold ?? 0) >= (tile.prices[level] || 0);

  const handleUpgradeToLevel = (level: number) => {
    if (!canUpgradeToLevel(level)) return;
    const price = tile.prices[level];
    if (!window.confirm(t('tileCard.confirmUpgrade', { tileName: tile.name, gold: price })))
      return;

    player.gold = (player.gold || 0) - (price || 0);
    tile._level = level;
    say(
      t('tileCard.upgradedMessage', { playerName: player.name, tileName: tile.name, level }),
      'info'
    );
    updateGameState(gameState);
    forceRerender((v) => v + 1);
  };

  const priceTag = (level: number) => {
    const gold = tile.prices[level] ?? 0;
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
        {clickable ? '👛' : ' '}{' '}
        <span style={lacksGold ? { color: '#ff4444', fontWeight: 'bold' } : undefined}>
          {lacksGold && '🔻'}
          {gold}🟡
        </span>
      </span>
    );
  };

  const currently = (level: number, currentLevel: number) => {
    return (
      <span className={'upgrade-price-badge'}>{level === currentLevel ? t('tileClaimScreen.now') : ''}</span>
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
        t('tileCard.confirmSell', {
          tileName: tile.name,
          price: fmtPrice(sellPrice.gold, sellPrice.units, t('common.and')),
        })
      )
    )
      return;

    const refunds = sellTile(gameState, player, tile);
    updateGameState(gameState);
    say(
      t('tileCard.soldMessage', {
        playerName: player.name,
        tileName: tile.name,
        gold: refunds.gold,
        units: refunds.units,
      }),
      'info'
    );
    clearScreen();
  };

  const handleYieldToggle = () => {
    if (tile.isYielded) {
      const cost = takeBackCost(tile);
      if (player.gold < cost) {
        sayLocal(t('yieldTile.cannotAfford', { gold: cost, tileName: tile.name }), 'error');
        return;
      }

      if (!window.confirm(t('tileCard.confirmTakeBack', { tileName: tile.name, gold: cost })))
        return;
      takeTileBack(gameState, player, tile);
    } else {
      const refund = Math.floor(tile.currentPrice.gold / 2);
      if (!window.confirm(t('tileCard.confirmYield', { tileName: tile.name, gold: refund })))
        return;
      yieldTile(gameState, player, tile);
    }

    updateGameState(gameState);
    forceRerender((v) => v + 1);
  };

  const ownerTag =
    variant === 'claimed'
      ? 'tileClaimScreen.claimedBy'
      : tile.isYielded
        ? 'tileClaimScreen.yieldedBelongsTo'
        : 'tileClaimScreen.belongsTo';

  return (
    <ScreenBackground
      image={variant === 'upgrades' ? 'assets/screens/guards.jpg' : 'assets/screens/victory.jpg'}
      style={{ paddingTop: '1rem' }}
    >
      <Fade />
      <Fade amount={0.3} />

      {variant === 'upgrades' && (
        <button
          onClick={() => clearScreen()}
          className="tile-card-close"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            fontSize: '16px',
            filter: 'grayscale(100%)',
            opacity: 0.8,
            zIndex: 6002,
          }}
        >
          ❌
        </button>
      )}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
      >
        {tile.spriteImage && (
          <SpriteCircleIcon src={tile.spriteImage} size="5rem" style={{ marginBottom: '0' }} />
        )}
        <div className="text-title" style={{ marginBottom: '0' }}>
          {tile.name}
        </div>
      </div>

      {variant === 'upgrades' && (
        <div
          className="tile-card-sell"
          style={{
            margin: '0.6rem auto',
            zIndex: 6002,
          }}
        >
          <div onClick={handleYieldToggle} className="tile-card-button tile-card-sell-item">
            👑 {tile.isYielded ? t('tileCard.takeBack') : t('tileCard.yieldToKing')}
          </div>
          <div onClick={handleSell} className="tile-card-button tile-card-sell-item">
            🪙 {t('tileCard.sell')}
          </div>
        </div>
      )}

      <div
        className="tile-claim-owner-banner"
        style={{
          background:
            'url("/assets/shade.jpg") center / cover no-repeat,\
            linear-gradient(' +
            player.color +
            ', ' +
            player.color +
            ')',
          backgroundBlendMode: 'hard-light',
        }}
      >
        {tJsx(ownerTag, {
          player: player.name,
          fame: <>🏆{player.fame}</>,
          gold: <>🟡{player.gold}</>,
        })}
      </div>

      {!tile.isYielded && (
        <div className="upgrades-table">
          {currentLevel < 2 && (
            <div
              className={
                'upgrade-level' + (currentLevel === 1 ? ' current-level' : ' upgrade-unreachable')
              }
            >
              <div className="big-icon-hint">
                <span className="value">🏯</span>
              </div>

              {currently(currentLevel, 1)}

              <div className="big-icon-hint">
                <div>{turnIncomeLabel(1)}</div>
                <div>{t('tileCard.perTurn')}</div>
              </div>

              {isTower && (
                <div className="big-icon-hint">
                  <div>{towerYearlyLabel(1)}</div>
                  <div>{t('tileCard.perYear')}</div>
                </div>
              )}
            </div>
          )}

          {currentLevel < 3 && (
            <div className={'upgrade-level' + (currentLevel === 2 ? ' current-level' : '')}>
              <div className="big-icon-hint">
                <span className="value">🏯🏯</span>
              </div>

              {currentLevel === 2 ? currently(currentLevel, 2) : priceTag(2)}

              <div className="big-icon-hint">
                <div>{turnIncomeLabel(2)}</div>
                <div>{t('tileCard.perTurn')}</div>
              </div>

              {isTower && (
                <div className="big-icon-hint">
                  <div>{towerYearlyLabel(2)}</div>
                  <div>{t('tileCard.perYear')}</div>
                </div>
              )}
            </div>
          )}
          {currentLevel <= 3 && (
            <div
              className={
                'upgrade-level' +
                (nextLevel !== 3 ? ' upgrade-unreachable' : '') +
                (currentLevel === 3 ? ' current-level' : '')
              }
            >
              <div className="big-icon-hint">
                <span className="value">🏯🏯🏯</span>
              </div>

              {currentLevel === 3 ? currently(currentLevel, 3) : priceTag(3)}

              <div className="big-icon-hint">
                <div>{turnIncomeLabel(3)}</div>
                <div>{t('tileCard.perTurn')}</div>
              </div>

              {isTower && (
                <div className="big-icon-hint">
                  <div>{towerYearlyLabel(3)}</div>
                  <div>{t('tileCard.perYear')}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-message tile-guards-dialogue">
        {totalMilitiaPool > 0 && !tile.isYielded && (
          <div className="guards-hire">
            {t('tileClaimScreen.onGuard')}
            <div className="guards-hire-scroll" style={{}}>
              <div className="big-icon-hint">
                <div>{totalMilitiaPool - displayedGarrison}🧍🚩</div>
                <div>{t('tileClaimScreen.army')}</div>
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
                <div>{displayedGarrison}🧍</div>
                <div>{t('garrisonsScreen.maxLabel', { max: defenceCapacity(tile.level) })}</div>
              </div>
            </div>
            <div className="garrisonVisitCaveat">{t('tileClaimScreen.garrisonVisitCaveat')}</div>
          </div>
        )}
      </div>

      <div className="game-menu">
        <div>
          {tile.isYielded ? (
            <DecoratedButton onClick={() => clearScreen()}>
              {t('tileClaimScreen.kingSeesTheWay')}
            </DecoratedButton>
          ) : (
            <DecoratedButton onClick={handleSetGarrison}>
              {garrisonAmount === 0
                ? t('tileClaimScreen.leaveUnguarded')
                : t('tileClaimScreen.setToGuard', { amount: garrisonAmount })}
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
