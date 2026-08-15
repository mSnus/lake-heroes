import React, { useEffect, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import { getOverrides } from '../utils/overridesStore';
import { UnitTier } from '../game/army';
import { PlayerLabel } from './PlayerLabel';
import { DecoratedButton } from './DecoratedButton';
import { SquadDisplay } from './SquadDisplay';
import { SquadHirePanel } from './SquadHirePanel';
import { pickKingsCastleHireAmount, pickKingsCastleHireTier } from '../ai/decisions';
import { KingsContract } from '../game/kingsContracts';
import { useT } from '../i18n';
import { tJsx } from '../i18n/tJsx';

interface BuyUnitsModalProps {
  gameState: GameState;
  /** Only a contract issued on THIS visit is shown; carried-over ones are not. */
  newContract?: KingsContract | null;
  onBuy: (amount: number, tier: UnitTier) => void;
  onSell: (tier: UnitTier, amount: number) => void;
  onUpgrade: (count: number) => void;
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({
  gameState,
  newContract,
  onBuy,
  onSell,
  onUpgrade,
  onSkip,
}) => {
  const t = useT();
  const player = gameState.activePlayer;

  // onBuy/onSell mutate `player` in place and re-render the app's own
  // gameState tree, but this modal is a static `content:` element handed
  // to screenStore once at mount — nothing re-invokes it on its own. Bump
  // this to force a re-render so the squad display and gold/fame-derived
  // text below reflect the change immediately instead of on the next
  // unrelated re-render.
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

  const contract = newContract ?? null;
  const contractTile = contract ? gameState.tiles[contract.tilePosition] : null;

  const canRecruitRiders = player.isKnight;

  // Neither tier has any room left — gold or slots block both militia and
  // riders (slot count already scales with fame, so that's the real fame
  // cap — no separate per-visit throttle). Shown as a single "can't recruit"
  // message instead of the full recruiting panel (the squad display and
  // sell buttons stay usable either way, since selling frees room).
  const militiaMax = Math.min(Math.floor(player.gold / getOverrides().militiaPrice), player.remainingCapacity('militia'));
  const ridersMax = canRecruitRiders
    ? Math.min(Math.floor(player.gold / getOverrides().riderPrice), player.remainingCapacity('riders'))
    : 0;
  const atMax = militiaMax <= 0 && ridersMax <= 0;
  // Recruiting can also be blocked purely by empty pockets — only mention
  // "full army slots" when the army genuinely has no free slot left.
  const slotsFull = player.slotsUsed >= player.armySlots;

  useEffect(() => {
    if (!player.isComputer) return;
    const botTier = pickKingsCastleHireTier(player);
    const botUnitPrice = botTier === 'riders' ? getOverrides().riderPrice : getOverrides().militiaPrice;
    const botMaxAmount = Math.min(
      Math.floor(player.gold / botUnitPrice),
      player.remainingCapacity(botTier)
    );
    const hireAmount = pickKingsCastleHireAmount(player, botMaxAmount, botUnitPrice);
    const timer = setTimeout(() => {
      if (hireAmount > 0) onBuy(hireAmount, botTier);
      onSkip();
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/king.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content" style={{ color: `white`, fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('kingsCastle.title')}</h2>
        <h3>{gameState.kingRewardMessage}, <PlayerLabel player={player} /></h3>

        <h3>
          {tJsx('kingsCastle.moneyAndFame', {
            gold: <span className="value">{player.gold}🟡</span>,
            fame: <span className="value">{player.fame}🏆</span>,
            squads: <span className="value">{t('squadDisplay.youHaveSquads', { squads: player.armySlots })}</span>,
          })}
        </h3>

        {contract && contractTile && (
          <h3 className='king-contract' style={{ whiteSpace: 'pre-line' }}>
            {tJsx('kingsCastle.newContract', {
              tileName: contractTile.name,
              award: <span className="value">{contract.award}</span>,
            })}
          </h3>
        )}

        <SquadDisplay
          militia={player.militia}
          riders={player.riders}
          totalSlots={player.armySlots}
          onSellSquad={handleSell}
          onUpgradeSquad={handleUpgrade}
          canUpgradeToRiders={canRecruitRiders}
          playerGold={player.gold}
          className="squad-display-large"
        />

        {atMax ? (
          <h3 style={{ whiteSpace: 'pre-line' }}>
            {t(slotsFull ? 'kingsCastle.cannotRecruit' : 'kingsCastle.cannotRecruitNoMoney')}
          </h3>
        ) : (
          <SquadHirePanel player={player} showRiders={canRecruitRiders} onBuy={handleBuy} />
        )}

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onSkip}>{t('kingsCastle.iAmTheGreatest')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default KingsCastleModal;
