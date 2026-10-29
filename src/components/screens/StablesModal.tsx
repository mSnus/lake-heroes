import { hireMax } from '../../game/resources';
import React, { useEffect, useState } from 'react';
import { GameState } from '../../game/GameState';
import '../../styles/modal.css';
import GameModal from './GameModal';
import { UnitTier } from '../../game/army';
import { DecoratedButton } from '../ui/DecoratedButton';
import { ArmyDisplay } from '../ui/ArmyDisplay';
import { SquadHirePanel } from '../ui/SquadHirePanel';
import { useHireFooter } from '../ui/useHireFooter';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { formatArmy } from '../../utils/formatArmy';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';
import { planArmyPurchase } from '../../ai/botPlans';

interface StablesModalProps {
  gameState: GameState;
  joinedHtml?: string;
  militiaPrice: number;
  riderPrice: number;
  onBuy: (amount: number, tier: UnitTier) => void;
  onSell: (tier: UnitTier, amount: number) => void;
  onUpgrade: (count: number) => void;
  onSkip: () => void;
}

const StablesModal: React.FC<StablesModalProps> = ({
  gameState,
  joinedHtml,
  militiaPrice,
  riderPrice,
  onBuy,
  onSell,
  onUpgrade,
  onSkip,
}) => {
  const t = useT();
  const player = gameState.activePlayer;

  const [, forceRerender] = useState(0);
  const handleBuy = (amount: number, tier: UnitTier) => {
    onBuy(amount, tier);
    footer.clear(tier);
    forceRerender((v) => v + 1);
  };

  const handleSell = (tier: UnitTier, count: number) => {
    onSell(tier, count);
    forceRerender((v) => v + 1);
  };

  const handleUpgrade = (count: number) => {
    onUpgrade(count);
    forceRerender((v) => v + 1);
  };

  const canRecruitRiders = player.isKnight;

  const ridersMax = canRecruitRiders
    ? hireMax(player, 'riders', riderPrice)
    : 0;
  const atMax = ridersMax <= 0;

  const footer = useHireFooter(canRecruitRiders && !atMax);
  const pendingRiders = footer.amountOf('riders');
  const isHiring = pendingRiders > 0;
  const footerLabel = isHiring
    ? t('squadHirePanel.hireButton', { army: formatArmy(0, pendingRiders) })
    : t('stables.leave');

  useEffect(() => {
    if (!player.isComputer) return;
    const plan = planArmyPurchase(player, { militiaPrice, riderPrice }, { ridersOnly: true });
    const timer = setTimeout(() => {
      for (const step of plan) {
        if (step.kind === 'sell') onSell(step.tier, step.count);
        else if (step.kind === 'upgrade') onUpgrade(step.count);
        else onBuy(step.count, step.tier);
      }

      onSkip();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/stables.jpg"
      noBorder={true}
    >
      <div className="modal-content" style={{ color: 'white', fontFamily: 'HeroesTextured' }}>
        <h2 className="game-title">{t('stables.title')}</h2>
        {joinedHtml && (
          <h3 style={{ whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: joinedHtml }} />
        )}

        <h3>
          <PlayerLabel player={player} bold />
        </h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          {tJsx('tavern.moneyAndFame', {
            gold: (
              <span className="value">
                <Gold amount={player.gold} />
              </span>
            ),
            fame: (
              <span className="value">
                <Fame amount={player.fame} />
              </span>
            ),
          })}
        </div>

        <ArmyDisplay
          militia={player.militia}
          riders={player.riders}
          pendingRiders={pendingRiders}
          capacity={player.armyCapacity}
          showRiders={player.isKnight || player.riders > 0}
          spriteColor={player.image}
          isKnight={canRecruitRiders}
          onSell={handleSell}
          onUpgrade={handleUpgrade}
          canUpgradeToRiders={canRecruitRiders}
          wallet={player}
          upgradePricePerUnit={riderPrice - militiaPrice}
          className="squad-display-large"
        />

        {/* Riders are all the Stables sells, so a player who is not a Knight
            has nothing to hire here and sees no dialogue at all. */}
        {canRecruitRiders &&
          (atMax ? (
            <h3 style={{ whiteSpace: 'pre-line' }}>{t('tavern.cannotRecruit')}</h3>
          ) : (
          <SquadHirePanel
            player={player}
            showRiders
            showMilitia={false}
            onBuy={handleBuy}
            militiaPrice={militiaPrice}
            riderPrice={riderPrice}
            onAmountChange={footer.onAmountChange}
            registerBuy={footer.registerBuy}
          />
          ))}

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={isHiring ? () => footer.buy('riders') : onSkip}>
            {footerLabel}
          </DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default StablesModal;
