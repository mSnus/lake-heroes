import React, { useState } from 'react';
import { GameState } from '../../game/GameState';
import { HARVEST_BUY_PRICE, HARVEST_SELL_PRICE } from '../../game/constants';
import { Resource, tradeResource } from '../../game/resources';
import { currentYear } from '../../game/year';
import GameModal from './GameModal';
import { DecoratedButton } from '../ui/DecoratedButton';
import { DecoratedSlider } from '../ui/DecoratedSlider';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { Food } from '../snippets/Food';
import { Arms } from '../snippets/Arms';
import { IncomeLabel, hasIncome } from '../snippets/IncomeLabel';
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

type Mode = 'buy' | 'sell';

const RESOURCES: Resource[] = ['food', 'arms'];

/**
 * A player's Harvest turn (see actions/harvest.ts): the year's income, and
 * sliders to buy or sell food and arms for gold at fixed prices.
 */
const HarvestModal: React.FC<HarvestModalProps> = ({ gameState, updateGameState, onClose }) => {
  const t = useT();
  const player = gameState.activePlayer;
  const [mode, setMode] = useState<Mode>('sell');
  const [amounts, setAmounts] = useState<Record<Resource, number>>({ food: 0, arms: 0 });
  const [preview, setPreview] = useState<Partial<Record<Resource, number>>>({});

  const shown = (r: Resource) => preview[r] ?? amounts[r];
  const other = (r: Resource): Resource => (r === 'food' ? 'arms' : 'food');
  // Buying shares one purse between both rows, so each row's max leaves
  // room for what the other has dialled in.
  const maxFor = (r: Resource) =>
    mode === 'sell'
      ? player[r]
      : Math.max(0, Math.floor((player.gold - shown(other(r)) * HARVEST_BUY_PRICE) / HARVEST_BUY_PRICE));

  const total = shown('food') + shown('arms');
  const goldDelta = mode === 'sell' ? total * HARVEST_SELL_PRICE : -total * HARVEST_BUY_PRICE;

  const switchMode = (next: Mode) => {
    setMode(next);
    setAmounts({ food: 0, arms: 0 });
    setPreview({});
  };

  const trade = () => {
    for (const r of RESOURCES) {
      const n = amounts[r];
      if (n > 0) tradeResource(player, r, mode === 'buy' ? n : -n);
    }

    setAmounts({ food: 0, arms: 0 });
    setPreview({});
    updateGameState(gameState);
  };

  const resourceLabel = (r: Resource, amount: number | string) =>
    r === 'food' ? <Food amount={amount} /> : <Arms amount={amount} />;

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/caravan.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content tavern-screen harvest-screen" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('harvest.title', { year: currentYear(gameState) })}</h2>
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
            {hasIncome(player.lastYearIncome ?? {}) ? (
              <IncomeLabel income={player.lastYearIncome} unitColor={player.image} />
            ) : (
              t('harvest.noIncome')
            )}
          </div>
        </div>

        <div className="harvest-mode">
          {(['buy', 'sell'] as const).map((m) => (
            <button
              key={m}
              className={'harvest-mode-button' + (mode === m ? ' harvest-mode-button--active' : '')}
              onClick={() => switchMode(m)}
            >
              {m === 'buy'
                ? t('harvest.buyMode', { price: HARVEST_BUY_PRICE })
                : t('harvest.sellMode', { price: HARVEST_SELL_PRICE })}
            </button>
          ))}
        </div>

        {RESOURCES.map((r) => (
          <div key={r} className="hire-row">
            <div className="hire-row-name">{resourceLabel(r, '')}</div>
            <DecoratedSlider
              min={0}
              max={maxFor(r)}
              value={Math.min(shown(r), maxFor(r))}
              onPreview={(v) => setPreview((p) => ({ ...p, [r]: v }))}
              onCommit={(v) => {
                setAmounts((a) => ({ ...a, [r]: v }));
                setPreview((p) => ({ ...p, [r]: undefined }));
              }}
            />
            <div className="hire-row-amount-label">{shown(r)}</div>
          </div>
        ))}

        <div className="harvest-trade">
          <div className={'shield-button-container' + (total > 0 ? '' : ' shield-button-container--disabled')}>
            <button className="shield-button hire-submit" onClick={trade} disabled={total <= 0} title={t('harvest.trade')}>
              <span className="hire-submit-icon">{mode === 'buy' ? '👛' : '⚖️'}</span>
              <span className="hire-row-caption">
                <Gold amount={goldDelta > 0 ? `+${goldDelta}` : goldDelta} />
              </span>
            </button>
          </div>
        </div>

        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <DecoratedButton onClick={onClose}>{t('harvest.finish')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default HarvestModal;
