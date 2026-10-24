import React, { useState } from 'react';
import { CostLabel } from '../snippets/CostLabel';
import { Player } from '../../game/Player';
import { GameState } from '../../game/GameState';
import { ScreenBackground } from './ScreenBackground';
import { DecoratedButton } from '../ui/DecoratedButton';
import { DecoratedSlider } from '../ui/DecoratedSlider';
import { ArmyDisplay } from '../ui/ArmyDisplay';
import { SquadHirePanel } from '../ui/SquadHirePanel';
import { useHireFooter } from '../ui/useHireFooter';
import { Militia } from '../snippets/Militia';
import { Rider } from '../snippets/Rider';
import { Fame } from '../snippets/Fame';
import { Gold } from '../snippets/Gold';
import { Food } from '../snippets/Food';
import { Arms } from '../snippets/Arms';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { clearScreen } from '../../utils/screenStore';
import { dismountSquad, dismountRefund, maxDismount } from '../../actions/dismountSquad';
import { sellUnits } from '../../actions/sellUnits';
import { upgradeSquad } from '../../actions/upgradeSquad';
import { buyUnits } from '../../actions/buyUnits';
import { tavernMilitiaPrice, tavernRiderPrice } from '../../actions/tavern';
import { hireMax, unitCost } from '../../game/resources';
import { UnitTier } from '../../game/army';
import { useT } from '../../i18n';
import '../../styles/GameMenu.css';
import '../../styles/GarrisonsScreen.css';
import { Fade } from './Fade';

interface ArmyScreenProps {
  gameState: GameState;
  player: Player;
  updateGameState: (board: GameState) => void;
}

/**
 * The player's own army: full detail (sell/upgrade existing units), the
 * fame-based capacity, and a hire dialogue always open at the Tavern's
 * premium rate -- no need to actually be standing on the Tavern tile for it
 * (see actions/tavern.ts's tavernMilitiaPrice/tavernRiderPrice). Opened
 * from the stats panel's army block (see CurrentPlayer.tsx) -- the
 * adjoining defence/garrison block opens GarrisonsScreen instead.
 */
export const ArmyScreen: React.FC<ArmyScreenProps> = ({ gameState, player, updateGameState }) => {
  const t = useT();

  const [, forceRerender] = useState(0);
  const refresh = () => forceRerender((v) => v + 1);

  const [dismount, setDismount] = useState(0);
  const dismountMax = maxDismount(player);
  const dismountPick = Math.min(dismount, dismountMax);

  const handleDismount = () => {
    dismountSquad(gameState, dismountPick, updateGameState);
    setDismount(0);
    refresh();
  };

  const handleSellSquad = (tier: UnitTier, count: number) => {
    sellUnits(gameState, count, updateGameState, tier);
    refresh();
  };

  const handleUpgradeSquad = (count: number) => {
    upgradeSquad(gameState, count, updateGameState);
    refresh();
  };

  const canRecruitRiders = player.isKnight;
  const militiaPrice = tavernMilitiaPrice();
  const riderPrice = tavernRiderPrice();
  const militiaMax = hireMax(player, 'militia', militiaPrice);
  const ridersMax = canRecruitRiders ? hireMax(player, 'riders', riderPrice) : 0;
  const atMax = militiaMax <= 0 && ridersMax <= 0;

  const footer = useHireFooter(!atMax);
  const handleBuy = (amount: number, tier: UnitTier) => {
    buyUnits(gameState, amount, updateGameState, tier, tier === 'riders' ? riderPrice : militiaPrice);
    footer.clear(tier);
    refresh();
  };

  const pendingTier: UnitTier | null =
    footer.amountOf('militia') > 0 ? 'militia' : footer.amountOf('riders') > 0 ? 'riders' : null;

  // What the sliders currently have dialled in (committed or mid-drag) would
  // cost -- subtracted from the player's actual holdings so the gold line up
  // top and the resource bar below react live to the hire panel, not just to
  // an actual purchase.
  const militiaUnitCost = unitCost('militia', militiaPrice);
  const riderUnitCost = unitCost('riders', riderPrice);
  const pendingMilitia = footer.amountOf('militia');
  const pendingRiders = footer.amountOf('riders');
  const projectedGold =
    player.gold - militiaUnitCost.gold * pendingMilitia - riderUnitCost.gold * pendingRiders;
  const projectedFood =
    player.food - militiaUnitCost.food * pendingMilitia - riderUnitCost.food * pendingRiders;
  const projectedArms =
    player.arms - militiaUnitCost.arms * pendingMilitia - riderUnitCost.arms * pendingRiders;

  // Militia is always the cheapest recruitable tier, so a resource that
  // can't cover even one of those blocks hiring outright -- that's the
  // "not enough for a single unit" flag on each resource row below.
  const shortOnGold = projectedGold < militiaUnitCost.gold;
  const shortOnFood = projectedFood < militiaUnitCost.food;
  const shortOnArms = projectedArms < militiaUnitCost.arms;
  const flagIfShort = (short: boolean, node: React.ReactNode): React.ReactNode =>
    short ? <span style={{ color: '#ff4d4d', fontWeight: 'bold' }}>🔻{node}</span> : node;

  return (
    <ScreenBackground
      image="assets/screens/battle.jpg"
      style={{ paddingTop: '1rem', justifyContent: 'space-evenly' }}
    >
      {/* Above the screen's Fade (z-index 5501, rendered last below) -- a
          position:static element's own z-index is inert, so everything
          interactive needs to sit inside one positioned, elevated box
          rather than being individually patched. */}
      <div
        style={{
          position: 'relative',
          zIndex: 5503,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          width: '100%',
          gap: '0.5rem',
        }}
      >
      <div className="text-title" style={{ marginBottom: '0' }}>
        {t('armyScreen.title')}
      </div>

      <div className="text-message" style={{ marginTop: 0 }}>
        <PlayerLabel player={player} bold /> <Fame amount={player.fame} /> <Gold amount={projectedGold} />
      </div>

      <ArmyDisplay
        militia={player.militia}
        riders={player.riders}
        pendingMilitia={pendingMilitia}
        pendingRiders={pendingRiders}
        capacity={player.armyCapacity}
        showRiders={player.isKnight || player.riders > 0}
        onSell={handleSellSquad}
        onUpgrade={handleUpgradeSquad}
        canUpgradeToRiders={player.isKnight}
        wallet={player}
        spriteColor={player.image}
        className="squad-display-large garrisons-army-display"
      />

      {player.riders > 0 && (
        <div className="garrisons-army">
          <div className="garrisons-dismount-block">
            <div className="garrisons-army-side">{t('armyScreen.dismount')}</div>
            <div className="garrisons-army-dismount">
              <div className="garrisons-army-side">
                <Rider amount={player.riders - dismountPick} color={player.image} />
              </div>
              <DecoratedSlider
                min={0}
                max={dismountMax}
                value={dismountPick}
                onPreview={setDismount}
                onCommit={setDismount}
              />
              <div className="garrisons-army-side">
                <Militia amount={player.militia + dismountPick} color={player.image} />
                {dismountPick > 0 && <CostLabel cost={dismountRefund(dismountPick)} sign="+" />}
              </div>
            </div>

            <div
              className={
                'shield-button-container' + (dismountPick > 0 ? '' : ' shield-button-container--disabled')
              }
            >
              <button
                className="shield-button hire-submit"
                onClick={handleDismount}
                disabled={dismountPick <= 0}
              >
                <span className="hire-submit-icon" style={{ fontSize: '1.2rem' }}>
                  ➜<Militia amount="" color={player.image} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '0.5rem', width: '100%' }}>
        <SquadHirePanel
          player={player}
          showRiders={canRecruitRiders}
          onBuy={handleBuy}
          militiaPrice={militiaPrice}
          riderPrice={riderPrice}
          onAmountChange={footer.onAmountChange}
          registerBuy={footer.registerBuy}
        />
      </div>

      <div
        className="player-stats-data player-stats-gold army-screen-resources"
        style={{ justifyContent: 'center', gap: '1rem', cursor: 'default' }}
      >
        <div className="player-stats-inline-row">{flagIfShort(shortOnGold, <Gold amount={projectedGold} />)}</div>
        <div className="player-stats-inline-row">{flagIfShort(shortOnFood, <Food amount={projectedFood} />)}</div>
        <div className="player-stats-inline-row">{flagIfShort(shortOnArms, <Arms amount={projectedArms} />)}</div>
      </div>

      <div className="game-menu pay-or-fight-grid" style={{ '--pay-or-fight-cols': 1 } as React.CSSProperties}>
        <DecoratedButton onClick={pendingTier ? () => footer.buy(pendingTier) : () => clearScreen()}>
          {pendingTier ? t('armyScreen.hireAmount', { amount: footer.amountOf(pendingTier) }) : t('armyScreen.close')}
        </DecoratedButton>
      </div>
      </div>

      <Fade />
    </ScreenBackground>
  );
};

export default ArmyScreen;
