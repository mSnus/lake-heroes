import React, { useEffect, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import { UnitTier } from '../game/army';
import { DecoratedButton } from './DecoratedButton';
import { SquadDisplay } from './SquadDisplay';
import { SquadHirePanel } from './SquadHirePanel';
import { useT } from '../i18n';
import { planArmyPurchase } from '../ai/botPlans';

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

  const militiaMax = Math.min(Math.floor(player.gold / militiaPrice), player.remainingCapacity('militia'));
  const ridersMax = canRecruitRiders
    ? Math.min(Math.floor(player.gold / riderPrice), player.remainingCapacity('riders'))
    : 0;
  const atMax = militiaMax <= 0 && ridersMax <= 0;

  useEffect(() => {
    if (!player.isComputer) return;
    const plan = planArmyPurchase(player, { militiaPrice, riderPrice });
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
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('stables.title')}</h2>
        {joinedHtml && (
          <h3 style={{ whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: joinedHtml }} />
        )}

        <h3>{t('squadDisplay.youHaveSquads', { squads: player.armySlots })}</h3>

        <SquadDisplay
          militia={player.militia}
          riders={player.riders}
          totalSlots={player.armySlots}
          onSellSquad={handleSell}
          onUpgradeSquad={handleUpgrade}
          canUpgradeToRiders={canRecruitRiders}
          playerGold={player.gold}
          upgradePricePerUnit={riderPrice - militiaPrice}
          className="squad-display-large"
        />

        {atMax ? (
          <h3 style={{ whiteSpace: 'pre-line' }}>{t('tavern.cannotRecruit')}</h3>
        ) : (
          <SquadHirePanel
            player={player}
            showRiders={canRecruitRiders}
            onBuy={handleBuy}
            militiaPrice={militiaPrice}
            riderPrice={riderPrice}
          />
        )}

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onSkip}>{t('stables.leave')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default StablesModal;
