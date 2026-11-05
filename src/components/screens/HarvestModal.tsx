import React, { useState } from 'react';
import { GameState } from '../../game/GameState';
import { currentYear, GROUP_EMOJI } from '../../game/year';
import { DOUBLE_INCOME_EFFECT } from '../../game/yearCore';
import { GAME_START_YEAR } from '../../game/constants';
import GameModal from './GameModal';
import { DecoratedButton } from '../ui/DecoratedButton';
import { ResourceTradeBlock } from './ResourceTradeBlock';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { Food } from '../snippets/Food';
import { Arms } from '../snippets/Arms';
import { IncomeLabel, hasIncome } from '../snippets/IncomeLabel';
import { Militia } from '../snippets/Militia';
import { computeAnnualReward } from '../../game/kingsGrace';
import { useT } from '../../i18n';
import '../../styles/modal.css';
import '../../styles/SquadHirePanel.css';
import '../../styles/HarvestModal.css';

interface HarvestModalProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
  /** Ends the player's Harvest turn. */
  onClose: () => void;
}

/**
 * A player's Harvest turn (see actions/harvest.ts): the year's income, and
 * the shared buy/sell/exchange trading block (see ResourceTradeBlock) to
 * trade food and arms at fixed prices.
 */
const HarvestModal: React.FC<HarvestModalProps> = ({ gameState, updateGameState, onClose }) => {
  const t = useT();
  const player = gameState.activePlayer;
  const year = currentYear(gameState);
  const calendarYear = GAME_START_YEAR + year;
  const annual = computeAnnualReward(gameState, player);
  // Static `content:` element handed to screenStore once at mount -- nothing
  // re-invokes it on trade, so force a re-render to show it immediately.
  const [, forceRerender] = useState(0);
  const doubleGroups = gameState.yearEffects
    .filter((e) => e.id === DOUBLE_INCOME_EFFECT && e.untilYear === year)
    .map((e) => `${GROUP_EMOJI[e.group ?? ''] ?? ''} ${t(`year.groupName.${e.group}`)}`);
  const doubleIncomeNote = doubleGroups.length > 0
    ? t('year.doubleIncomeAnnounce', { groups: doubleGroups.join(` ${t('common.and')} `) })
    : null;

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/caravan.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div
        className="modal-content tavern-screen harvest-screen"
        style={{ color: 'white', fontFamily: 'HeroesTextured' }}
      >
        <h2 className="text-title" style={{ marginBottom: 0}}>
          {t('harvest.title')}
        </h2>
        <div className="harvest-subtitle">{t('harvest.subtitle', { year: calendarYear })}</div>
        {doubleIncomeNote && <div className="harvest-double-income-note">{doubleIncomeNote}</div>}
        <h3>
          <PlayerLabel player={player} bold />
        </h3>
        <div className="harvest-stats">
          <Fame amount={player.fame} />
          <Gold amount={player.gold} />
          <Food amount={player.food} />
          <Arms amount={player.arms} />
        </div>

        <div className="harvest-income">
          <div className="harvest-caption">{t('harvest.yearIncome')}</div>
          <div className="harvest-stats">
            {hasIncome({ ...player.lastYearIncome, units: 0 } ?? {}) ? (
              <IncomeLabel
                income={{ ...player.lastYearIncome, units: 0 }}
                unitColor={player.image}
                unitKnight={player.isKnight}
              />
            ) : (
              t('harvest.noIncome')
            )}
          </div>
        </div>

        <div className="harvest-income">
          <div className="harvest-caption">{t('harvest.kingsGrace')}</div>
          <div className="harvest-stats">
            {annual.totalGold > 0 && <Gold amount={`+${annual.totalGold}`} />}
            {annual.totalUnits > 0 && (
              <Militia
                amount={`+${annual.totalUnits}`}
                color={player.image}
                knight={player.isKnight}
              />
            )}
          </div>
        </div>

        <ResourceTradeBlock
          player={player}
          onTrade={() => {
            updateGameState(gameState);
            forceRerender((v) => v + 1);
          }}
        />

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onClose}>{t('harvest.finish')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default HarvestModal;
