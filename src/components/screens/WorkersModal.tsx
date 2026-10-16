import React, { useEffect, useState } from 'react';
import { GameState } from '../../game/GameState';
import '../../styles/modal.css';
import GameModal from './GameModal';
import { UnitTier } from '../../game/army';
import { DecoratedButton } from '../ui/DecoratedButton';
import { SquadDisplay } from '../ui/SquadDisplay';
import { SquadHirePanel } from '../ui/SquadHirePanel';
import { formatArmy } from '../../utils/formatArmy';
import { tavernMilitiaPrice, tavernRiderPrice } from '../../actions/tavern';
import { useT } from '../../i18n';
import { planArmyPurchase } from '../../ai/botPlans';

/** Workers reuse 🧍🏾 rather than the army's own 🧍, so the close button
 * never reads as reporting on the traveling army itself. */
const WORKER_EMOJI = { militia: '🧍🏾', riders: '🐎' };

interface WorkersModalProps {
  gameState: GameState;
  onBuy: (amount: number, tier: UnitTier) => void;
  onSell: (tier: UnitTier, amount: number) => void;
  onUpgrade: (count: number) => void;
  onSkip: () => void;
}

/**
 * Workers' hire dialogue -- same mechanics and prices as the Tavern's (see
 * actions/tavern.ts's tavernMilitiaPrice/tavernRiderPrice), just reached as
 * a random encounter instead of a tile. The close button itself reports
 * what was hired this visit, tallied locally since onBuy commits instantly
 * (same as the Tavern) rather than staging a pending amount.
 */
const WorkersModal: React.FC<WorkersModalProps> = ({ gameState, onBuy, onSell, onUpgrade, onSkip }) => {
  const t = useT();
  const player = gameState.activePlayer;
  const militiaPrice = tavernMilitiaPrice();
  const riderPrice = tavernRiderPrice();

  // onBuy/onSell mutate `player` in place but this modal is a static
  // `content:` element handed to screenStore once at mount, so nothing else
  // re-invokes it — force a re-render so the squad row and gold/fame-derived
  // text update immediately (mirrors TavernModal/KingsCastleModal).
  const [, forceRerender] = useState(0);
  const [hiredMilitia, setHiredMilitia] = useState(0);
  const [hiredRiders, setHiredRiders] = useState(0);

  const handleBuy = (amount: number, tier: UnitTier) => {
    onBuy(amount, tier);
    if (tier === 'riders') setHiredRiders((n) => n + amount);
    else setHiredMilitia((n) => n + amount);
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
        else handleBuy(step.count, step.tier);
      }

      onSkip();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const closeLabel =
    hiredMilitia + hiredRiders > 0
      ? t('workersEncounter.hireButton', { army: formatArmy(hiredMilitia, hiredRiders, WORKER_EMOJI) })
      : t('workersEncounter.passByButton');

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/caravan.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content tavern-screen" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('workersEncounter.title')}</h2>
        <h3
          style={{ whiteSpace: 'pre-line' }}
          dangerouslySetInnerHTML={{
            __html: t('workersEncounter.message', {
              playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
            }),
          }}
        />

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

        <div style={{ marginTop: '1rem' }}>
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
        </div>

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onSkip}>{closeLabel}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default WorkersModal;
