import React from 'react';
import { Tile } from '../game/Tile';
import '../styles/TileCard.css';
import { say, sayLocal } from '../utils/say';
import { GameState } from '../game/GameState';
import { sellTile } from '../actions/sellTile';
import { claimTile } from '../actions/claimTile';
import { yieldTile, takeTileBack, takeBackCost } from '../actions/yieldTile';
import { gameEvent } from '../utils/events';
import { garrisonSlotCapacity, isBanzaiAttack } from '../game/army';
import { UNIT_POWER } from '../game/army';
import { claimAffordability } from '../game/tileOwnership';
import { syndicateMultiplier } from '../game/syndicate';
import { tileTurnIncome } from '../game/income';
import { hasYearEffect, DOUBLE_INCOME_EFFECT } from '../game/year';
import { BRAWL_THRESHOLD } from '../game/constants';
import { isBrawlMatchup } from '../actions/battles/common';
import DecoratedButton from './DecoratedButton';
import { TileUpgradesScreen } from './TileUpgradesScreen';
import { Gold } from './Gold';
import { showScreen } from '../utils/screenStore';
import { useT } from '../i18n';

export const fmtPrice = (gold: number, units: number, join: string = ''): string => {
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
  /** True when this card is rendered inside a forced pay-or-fight/sell-to-
   * pay screen — opening the full-screen Tile Upgrades screen from there
   * would silently replace (and lose) that screen instead of stacking on
   * top of it, so title/upgrade-zone clicks fall back to just expanding
   * the card instead of navigating away. */
  disableUpgradesScreen?: boolean;
};

export const TileCard: React.FC<TileCardProps> = ({
  tile,
  mode = 'display',
  gameState,
  updateGameState,
  couldBuy = false,
  defaultExpanded = false,
  demoMode = false,
  disableUpgradesScreen = false,
}) => {
  const t = useT();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  if (!tile || !tile.name) return null;

  const groupColor = tile.groupColor;
  const ownerPlayer = gameState?.players.find((p) => p.id === tile.owner) ?? null;

  // Syndicate: the owner holds every ownable tile of this group, which doubles
  // the income bonus.
  const syndicateMult =
    gameState && ownerPlayer ? syndicateMultiplier(gameState, ownerPlayer, tile.group) : 1;
  const isSyndicate = syndicateMult > 1;

  // Per-turn payout at the tile's current level (see game/income.ts's
  // tileTurnIncome) -- exactly one of gold/units is nonzero, depending on
  // the tile's own bonus type. The figure below is already doubled when
  // this year's lucky groups include this tile's own (see game/year.ts) --
  // the badge is purely an annotation explaining why, not a second
  // multiplier applied here.
  const turnIncome = tileTurnIncome(
    tile,
    syndicateMult,
    undefined,
    gameState,
    ownerPlayer ?? undefined
  );
  const doubleIncomeActive =
    !!gameState && hasYearEffect(gameState, DOUBLE_INCOME_EFFECT, tile.group);
  // Units below this are hidden entirely (not just rounded away) -- a
  // trickle of 1 isn't worth a line, but that means the "per turn" caption
  // below must stay hidden right along with it, not dangle on its own.
  const hasTurnIncome = turnIncome.gold > 0 || turnIncome.units > 1;
  const turnIncomeLabel = (
    <>
      {turnIncome.gold > 0 && (
        <>
          <Gold amount={`+${turnIncome.gold}`} />
          {doubleIncomeActive && <span className="tile-card-double-income">×2</span>}{' '}
        </>
      )}
      {turnIncome.units > 1 && <>+{turnIncome.units}🧍</>}
    </>
  );

  // Some units-type tiles' (Camps/Towers) extra per-level toll (see
  // game/kingsGrace.ts's computeAnnualReward) only pays out once a lap, not
  // every turn like the rest of a tile's income -- shown as its own "per
  // year" block alongside the per-turn one.
  const yearlyUnitsBonus = tile.annualUnits[tile.level] ?? 0;
  const isTower = yearlyUnitsBonus > 0;
  const towerYearlyLabel = <>+{yearlyUnitsBonus}👬</>;

  const bonusType = getBonusType(tile);

  // Price cell for the level breakdown table. Upgrades only cost gold. On the
  // upgrade-target row of an owned tile that the player can't afford, it's
  // shown bold red with a 🔻 prefix (same treatment as the "can't own" case).
  const priceCell = (level: number, useWalletIcon = false) => {
    const gold = tile.prices[level] ?? 0;
    const isOwnedByActive = mode === 'owned' && tile.owner === activePlayer?.id;
    const isUpgradeTarget = isOwnedByActive && level === nextLevel && !maxLevelReached;
    const lacksGold = !!isUpgradeTarget && !!activePlayer && (activePlayer.gold ?? 0) < gold;
    const redBold = { color: '#ff4444', fontWeight: 'bold' as const };

    if (gold <= 0) return <>0</>;

    const icon = lacksGold ? '❌ ' : useWalletIcon ? ' ' : 'ᅠ';

    return (
      <>
        <span>{icon}</span>
        {!useWalletIcon && (level > currentLevel ? '+' : ' ')}
        <span style={lacksGold ? redBold : undefined}>
          {lacksGold && '🔻'}
          <Gold amount={gold} />
        </span>
      </>
    );
  };

  const bonus = (level: number) => (tile.bonuses[level] ?? 0) * syndicateMult;
  const defence = (level: number) => tile.getDefence(level);
  const defenceCapacity = (level: number) => garrisonSlotCapacity() * level;

  const bonusAmount = (level: number) =>
    bonusType === 'gold' ? <Gold amount={bonus(level)} /> : <>{bonus(level)} 🧍</>;

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
  // Rated strength on the shared scale (see UNIT_POWER), matching what
  // Tile.isAffordable compares against -- zombies count for more than their
  // headcount, and attackerPower is weighted the same way.
  const lvl1Defence = defence(1) * (tile.abandoned ? UNIT_POWER.zombies : 1);
  const attackerPower = activePlayer?.armyPower ?? 0;
  // Claim button label: raw militia+riders headcount, not the weighted power
  // score -- riders only get a "+N" suffix when the player actually has any
  // militia to add it to; with no militia at all, riders show alone instead
  // of a leading "0+".
  const attackerArmyLabel = !activePlayer
    ? '0'
    : activePlayer.militia > 0
      ? `${activePlayer.militia}${activePlayer.riders > 0 ? `+${activePlayer.riders}` : ''}`
      : `${activePlayer.riders}`;
  const isBrawlTile = isBrawlMatchup(lvl1Defence, attackerPower);

  const isBanzai = !!activePlayer && isBanzaiAttack(lvl1Defence, attackerPower);

  const attackEmoji = (isBrawlTile ? '👊' : '⚔️') + (isBanzai ? '🩸' : '');

  // Shared with AutoEndTurnNotice (game/tileOwnership.ts's
  // claimAffordability) so "claimable" has one definition -- it re-derives
  // lvl1Defence/attackerPower/isBanzai internally rather than taking the
  // copies above as params, a cheap duplicated computation. No activePlayer
  // (HelpScreen's static demo card, the only caller with no live game --
  // see TileCard's own gameState prop comment) reads as affordable, same as
  // before: nothing to compare against, so nothing to flag as lacking.
  const { unitsInsufficient, goldLacking, fameLacking, canClaim } = activePlayer
    ? claimAffordability(tile, activePlayer)
    : { unitsInsufficient: false, goldLacking: false, fameLacking: false, canClaim: true };

  const cantAfford = !canClaim;

  const isOnFire = tile.isOnFire(gameState?.round ?? 0);

  const currentLevel = tile.level || 1;
  const maxLevel = 3;
  const nextLevel = Math.min(currentLevel + 1, maxLevel);
  const maxLevelReached = currentLevel >= maxLevel;

  const canUpgrade =
    activePlayer &&
    !tile.isYielded &&
    currentLevel < maxLevel &&
    tile.prices &&
    tile.prices[currentLevel + 1] &&
    (activePlayer.gold ?? 0) >= (tile.prices[currentLevel + 1] || 0);

  const upgradeUnreachable = !canUpgrade || currentLevel === 1;

  // A yielded tile already cashed in half its price up front (see
  // yieldTile.ts) -- selling it on top of that only refunds 40% of the gold,
  // a real penalty vs a straight sale (mirrored exactly in sellTile.ts). The
  // garrison itself always comes back in full, yielded or not.
  const sellPrice = tile.isYielded
    ? {
        gold: Math.floor(tile.currentPrice.gold * 0.4),
        units: Math.floor(tile.currentPrice.units),
      }
    : tile.currentPrice;

  const handleClose = () => {
    if (demoMode) return;

    gameEvent('displayTile', {});
  };

  const handleSell = () => {
    if (demoMode) return;

    if (!gameState || !activePlayer) return;

    if (
      !window.confirm(
        t('tileCard.confirmSell', {
          tileName: tile.name,
          price: fmtPrice(sellPrice.gold, sellPrice.units, t('common.and')),
        })
      )
    )
      return;

    const refunds = sellTile(gameState, activePlayer, tile);

    updateGameState && updateGameState(gameState);

    say(
      t('tileCard.soldMessage', {
        playerName: activePlayer.name,
        tileName: tile.name,
        gold: refunds.gold,
        units: refunds.units,
      }),
      'info'
    );
  };

  const handleInfoClick = () => {
    setExpanded(!expanded);
  };

  const handleYieldToggle = () => {
    if (demoMode) return;
    if (!gameState || !updateGameState || !activePlayer) return;

    if (tile.isYielded) {
      const cost = takeBackCost(tile);
      if (activePlayer.gold < cost) {
        sayLocal(t('yieldTile.cannotAfford', { gold: cost, tileName: tile.name }), 'error');
        return;
      }

      if (!window.confirm(t('tileCard.confirmTakeBack', { tileName: tile.name, gold: cost })))
        return;
      takeTileBack(gameState, activePlayer, tile);
    } else {
      const refund = Math.floor(tile.currentPrice.gold / 2);
      if (!window.confirm(t('tileCard.confirmYield', { tileName: tile.name, gold: refund })))
        return;
      yieldTile(gameState, activePlayer, tile);
    }

    updateGameState(gameState);
  };

  // Garrison management, upgrading, and sell/yield all live on the Tile
  // Upgrades screen now — TileCard's job is just to open it.
  const openUpgradesScreen = () => {
    if (demoMode || disableUpgradesScreen) return;
    if (!gameState || !updateGameState || !activePlayer) return;
    if (tile.owner !== activePlayer.id) return;

    showScreen({
      content: React.createElement(TileUpgradesScreen, {
        tile,
        player: activePlayer,
        gameState,
        updateGameState,
      }),
    });
  };

  const upgradeRowProps = (level: number) =>
    mode === 'owned' &&
    tile.owner === activePlayer?.id &&
    !disableUpgradesScreen &&
    level === nextLevel
      ? {
          onClick: (e: React.MouseEvent) => {
            // Don't also bubble to the table's collapse-on-click handler.
            e.stopPropagation();
            openUpgradesScreen();
          },
          style: { cursor: 'pointer' as const },
        }
      : {};

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gameState || !updateGameState) return;

    claimTile(gameState, updateGameState);
  };

  return (
    <div
      className={
        'tile-card' +
        (mode === 'owned' && isSyndicate ? ' syndicate' : '') +
        (expanded ? ' expanded' : '') +
        (tile.isYielded ? ' yielded' : '')
      }
    >
      {tile.spriteImage && (
        <div
          className="tile-card-bg"
          style={{
            backgroundImage: `url(${tile.spriteImage})`,
            borderBottom: `solid 4px ${groupColor}`,
          }}
          onClick={
            tile.owner === activePlayer?.id && !disableUpgradesScreen
              ? openUpgradesScreen
              : handleInfoClick
          }
        >
          <div className="tile-card-title">
            {tile.name}
            <br />
            {tile.abandoned ? ' ' + t('tileCard.abandoned') : ''}
            {tile.isOwned() && (
              <div>
                <div className="tile-base-price">
                  {tile.prices[1] ? <Gold amount={tile.prices[1]} where={'before'} /> : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'display' && !demoMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="tile-card-close"
        >
          ❌
        </button>
      )}

      {tile.isOwnable && (
        <div className="tile-card-ownable">
          {/* Status banner, directly under the tile's image. A yielded tile
              can't be upgraded at all (see canUpgrade), so these two are
              mutually exclusive by construction. */}
          {mode === 'owned' && tile.isYielded && (
            <div className="upgrade-row">
              <div
                className="tile-card-upgradable yielded-row"
                style={{ backgroundColor: tile.groupColor + '4f' }}
              >
                {t('tileCard.yielded')}
              </div>
            </div>
          )}
          {((mode === 'owned' && canUpgrade) || demoMode) && (
            <div className="upgrade-row">
              <div
                className="tile-card-upgradable"
                style={{ backgroundColor: tile.groupColor + '4f' }}
                onClick={openUpgradesScreen}
              >
                {t('tileCard.upgradable')}
              </div>
            </div>
          )}

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
                          <div>
                            <Gold amount={tile.fee} where={'before'}/>
                          </div>
                          <div>{t('tileCard.fee')}</div>
                        </div>
                      </div>
                    )}

                    {tile.owner === activePlayer?.id && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {tile.isYielded ? (
                          <div className="big-icon-hint">
                            <div>👑</div>
                            <div>{t('tileCard.yielded')}</div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {hasTurnIncome && (
                              <div className="big-icon-hint">
                                <div>{turnIncomeLabel}</div>
                                <div>{t('tileCard.perTurn')}</div>
                              </div>
                            )}
                            {isTower && (
                              <div className="big-icon-hint">
                                <div>{towerYearlyLabel}</div>
                                <div>{t('tileCard.perYear')}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div></div>

                    <div className="big-icon-hint">
                      <div className="tile-defence">
                        {Array.from({ length: tile.level }, (_, i) => (
                          <span key={i}>🏯</span>
                        ))}
                        {tile.garrison}🧍
                      </div>

                      <div>
                        {t('garrisonsScreen.maxLabel', { max: defenceCapacity(tile.level) })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!tile.owner && (
                <div className="tile-card-base-info">
                  <div
                    className="tile-card-base-row"
                    style={{ display: 'flex', gap: '8px', flexDirection: 'row' }}
                  >
                    {hasTurnIncome && (
                      <div className="big-icon-hint">
                        {turnIncomeLabel}
                        <div>{t('tileCard.perTurn')}</div>
                      </div>
                    )}
                    {isTower && (
                      <div className="big-icon-hint">
                        <div>{towerYearlyLabel}</div>
                        <div>{t('tileCard.perYear')}</div>
                      </div>
                    )}
                  </div>

                  <div className="tile-card-base-row">
                    {isOnFire ? (
                      <div>
                        <div>🔥 {t('tileCard.razed')}</div>
                        <div>{t('tileCard.stillSmoldering')}</div>
                      </div>
                    ) : (
                      <div>
                        {cantAfford ? (
                          <div style={{ color: '#ff4444' }}>{t('tileCard.cantAfford')}</div>
                        ) : (
                          <div>{t('tileCard.toOwn')}</div>
                        )}

                        <div className="tile-card-claim-requirements">
                          {/* While the tile is unaffordable, a requirement the
                              player already meets is just noise -- only the
                              ones actually blocking the claim are shown. */}
                          {tile.requiredFame > 0 && (!cantAfford || fameLacking) && (
                            <>
                              <span
                                style={
                                  fameLacking
                                    ? { color: '#ff4444', marginRight: '8px' }
                                    : { marginRight: '8px' }
                                }
                              >
                                {fameLacking && '🔻'}
                                🏆{tile.requiredFame}
                              </span>
                              {'  '}
                            </>
                          )}

                          {(!cantAfford || goldLacking) && (
                            <span
                              style={
                                goldLacking
                                  ? { color: '#ff4444', paddingRight: '8px' }
                                  : { paddingRight: '8px' }
                              }
                            >
                              {goldLacking ? '🔻' : ' '}
                              <Gold amount={tile.currentPrice.gold ?? 0} where={'before'} />{' '}
                            </span>
                          )}
                          {/* The help screen's static sample card skips the unit
                              requirement line — misleading there since a battle now
                              sends the whole army, not a squad sized to Defence. */}
                          {!demoMode && (!cantAfford || unitsInsufficient) && (
                            <>
                              {'  '}

                              {unitsInsufficient ? (
                                <div style={{ color: '#ff4444' }}>
                                  {'🔻'}
                                  {defence(1)}
                                  {tile.abandoned ? '🧟‍♀️' : '⚔️'}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'nowrap',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.1rem',
                                  }}
                                >
                                  <div className="tile-card-attacker-army">{attackerArmyLabel}</div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      lineHeight: 1,
                                    }}
                                  >
                                    <div className="tile-card-attack-emoji">{attackEmoji}</div>
                                    <div className="tile-card-attack-vs">{t('common.vs')}</div>
                                  </div>
                                  <div className="tile-card-attacker-army">{defence(1)}</div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {expanded && (
              <div
                className="tile-card-table-wrap"
                onClick={handleInfoClick}
                style={{ cursor: 'pointer' }}
              >
                <table className="tile-card-table">
                  <tbody>
                    <tr
                      className={
                        mode === 'owned' && currentLevel > 1 ? 'upgrade-unreachable' : undefined
                      }
                      {...upgradeRowProps(1)}
                    >
                      <td className={class1}>{priceCell(1)}</td>
                      <td className={class1}>→</td>
                      <td className={class1}>+{bonusAmount(1)}</td>
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
                      <td className={class2}>+{bonusAmount(2)}</td>
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
                      <td className={class3}>+{bonusAmount(3)}</td>
                      <td className={class3}>{slotsAtLevel(3)}🏯 </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {expanded && (mode === 'owned' || demoMode) && (
              <div className="tile-card-sell" style={{ marginTop: '1rem' }}>
                <div
                  onClick={() => handleYieldToggle()}
                  className={'tile-card-button tile-card-small-button'}
                >
                  👑 {tile.isYielded ? t('tileCard.takeBack') : t('tileCard.yieldToKing')}
                </div>
                <div
                  onClick={() => handleSell()}
                  className={'tile-card-button tile-card-small-button'}
                >
                  🪙 {t('tileCard.sell')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!tile.owner && (
        <div>
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
                  filter: 'drop-shadow(2px 2px 3px #00000050)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.1rem',
                  }}
                >
                  <div>
                    {isBanzai
                      ? '🩸 ' + t('tileCard.banzai')
                      : attackEmoji + ' ' + t('tileCard.claimIt')}
                  </div>
                </div>
              </DecoratedButton>
            )}
        </div>
      )}
    </div>
  );
};

export default TileCard;
