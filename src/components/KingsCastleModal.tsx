import React, { useEffect } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import { RIDER_UNIT_PRICE, UNIT_PRICE } from '../game/constants';
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
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({
  gameState,
  newContract,
  onBuy,
  onSell,
  onSkip,
}) => {
  const t = useT();
  const player = gameState.activePlayer;

  const contract = newContract ?? null;
  const contractTile = contract ? gameState.tiles[contract.tilePosition] : null;

  const canRecruitRiders = player.isKnight;

  const maxForFame = Math.max(0, 2 * player.fame + 3 - player.unitsHiredThisTurn);

  // Neither tier has any room left — gold, fame, or slots block both militia
  // and riders. Shown as a single "can't recruit" message instead of the
  // full recruiting panel (the squad display and sell buttons stay usable
  // either way, since selling can free up room to recruit again).
  const militiaMax = Math.min(
    Math.floor(player.gold / UNIT_PRICE),
    maxForFame,
    player.remainingCapacity('militia')
  );
  const ridersMax = canRecruitRiders
    ? Math.min(Math.floor(player.gold / RIDER_UNIT_PRICE), maxForFame, player.remainingCapacity('riders'))
    : 0;
  const atMax = militiaMax <= 0 && ridersMax <= 0;

  useEffect(() => {
    if (!player.isComputer) return;
    const botTier = pickKingsCastleHireTier(player);
    const botUnitPrice = botTier === 'riders' ? RIDER_UNIT_PRICE : UNIT_PRICE;
    const botMaxAmount = Math.min(
      Math.floor(player.gold / botUnitPrice),
      Math.max(0, 2 * player.fame + 3 - player.unitsHiredThisTurn),
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

        {contract && contractTile && (
          <h3 className='king-contract' style={{ whiteSpace: 'pre-line' }}>
            {tJsx('kingsCastle.newContract', {
              tileName: contractTile.name,
              award: <span className="value">{contract.award}</span>,
            })}
          </h3>
        )}

        <h3 style={{ whiteSpace: 'pre-line' }}>
          {tJsx('kingsCastle.squadsMessage', {
            gold: <span className="value">{player.gold}🟡</span>,
            fame: <span className="value">{player.fame}</span>,
            squads: <span className="value">{player.armySlots}</span>,
          })}
        </h3>

        <SquadDisplay
          militia={player.militia}
          riders={player.riders}
          totalSlots={player.armySlots}
          onSellSquad={(tier, count) => onSell(tier, count)}
        />

        {atMax ? (
          <h3 style={{ whiteSpace: 'pre-line' }}>
            {tJsx('kingsCastle.cannotRecruit', {
              gold: <span className="value">{player.gold}🟡</span>,
              fame: <span className="value">{player.fame}</span>,
            })}
          </h3>
        ) : (
          <SquadHirePanel player={player} showRiders={canRecruitRiders} onBuy={onBuy} />
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
