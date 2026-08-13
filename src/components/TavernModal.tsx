import React, { useEffect, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import { UnitTier } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { DecoratedButton } from './DecoratedButton';
import { SquadDisplay } from './SquadDisplay';
import { SquadHirePanel } from './SquadHirePanel';
import { pickKingsCastleHireAmount } from '../ai/decisions';
import { useT } from '../i18n';

interface TavernModalProps {
  gameState: GameState;
  /** Pre-rendered HTML for the dice-roll result (joined/full-note message). */
  joinedHtml: string;
  onBuy: (amount: number, tier: UnitTier) => void;
  onSell: (tier: UnitTier, amount: number) => void;
  onSkip: () => void;
}

/** Tavern's post-roll screen: shows the free militia the roll won, then lets
 * the player recruit more with gold — same mechanics as King's Castle, but
 * militia only (the tavern doesn't train knights, so `showRiders` is always
 * false regardless of the player's rank). */
const TavernModal: React.FC<TavernModalProps> = ({ gameState, joinedHtml, onBuy, onSell, onSkip }) => {
  const t = useT();
  const player = gameState.activePlayer;

  // onBuy/onSell mutate `player` in place but this modal is a static
  // `content:` element handed to screenStore once at mount, so nothing else
  // re-invokes it — force a re-render so the squad row and gold/fame-derived
  // text update immediately (mirrors KingsCastleModal).
  const [, forceRerender] = useState(0);
  const handleBuy = (amount: number, tier: UnitTier) => {
    onBuy(amount, tier);
    forceRerender((v) => v + 1);
  };
  const handleSell = (tier: UnitTier, count: number) => {
    onSell(tier, count);
    forceRerender((v) => v + 1);
  };

  const militiaMax = Math.min(Math.floor(player.gold / getOverrides().militiaPrice), player.remainingCapacity('militia'));
  const atMax = militiaMax <= 0;

  useEffect(() => {
    if (!player.isComputer) return;
    const botMaxAmount = Math.min(
      Math.floor(player.gold / getOverrides().militiaPrice),
      player.remainingCapacity('militia')
    );
    const hireAmount = pickKingsCastleHireAmount(player, botMaxAmount, getOverrides().militiaPrice);
    const timer = setTimeout(() => {
      if (hireAmount > 0) onBuy(hireAmount, 'militia');
      onSkip();
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/tavern.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('tavern.title')}</h2>
        <h3 style={{ whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: joinedHtml }} />

        <h3>{t('squadDisplay.youHaveSquads', { squads: player.armySlots })}</h3>

        <SquadDisplay
          militia={player.militia}
          riders={player.riders}
          totalSlots={player.armySlots}
          onSellSquad={handleSell}
          className="squad-display-large"
        />

        {atMax ? (
          <h3 style={{ whiteSpace: 'pre-line' }}>{t('tavern.cannotRecruit')}</h3>
        ) : (
          <SquadHirePanel player={player} showRiders={false} onBuy={handleBuy} />
        )}

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onSkip}>{t('tavern.newFolksWelcome')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default TavernModal;
