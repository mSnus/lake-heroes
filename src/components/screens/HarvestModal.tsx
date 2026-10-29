import React, { useState } from 'react';
import { GameState } from '../../game/GameState';
import {
  Resource,
  tradeResource,
  harvestBuyPrice,
  harvestSellPrice,
  exchangeBatch,
  exchangeResource,
  maxExchangeBatches,
} from '../../game/resources';
import { currentYear, GROUP_EMOJI } from '../../game/year';
import { DOUBLE_INCOME_EFFECT } from '../../game/yearCore';
import { GAME_START_YEAR } from '../../game/constants';
import GameModal from './GameModal';
import { DecoratedButton } from '../ui/DecoratedButton';
import { DecoratedSlider } from '../ui/DecoratedSlider';
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

type Mode = 'buy' | 'sell' | 'exchange';

const RESOURCES: Resource[] = ['food', 'arms'];
const EX_KEY = { food: 'foodToArms', arms: 'armsToFood' } as const;

/**
 * A player's Harvest turn (see actions/harvest.ts): the year's income, and
 * sliders to buy or sell food and arms for gold at fixed prices.
 */
const HarvestModal: React.FC<HarvestModalProps> = ({ gameState, updateGameState, onClose }) => {
  const t = useT();
  const player = gameState.activePlayer;
  const year = currentYear(gameState);
  const calendarYear = GAME_START_YEAR + year;
  const annual = computeAnnualReward(gameState, player);
  const doubleGroups = gameState.yearEffects
    .filter((e) => e.id === DOUBLE_INCOME_EFFECT && e.untilYear === year)
    .map((e) => `${GROUP_EMOJI[e.group ?? ''] ?? ''} ${t(`year.groupName.${e.group}`)}`);
  const doubleIncomeNote = doubleGroups.length > 0
    ? t('year.doubleIncomeAnnounce', { groups: doubleGroups.join(` ${t('common.and')} `) })
    : null;
  const [mode, setMode] = useState<Mode>('sell');
  const [amounts, setAmounts] = useState<Record<Resource, number>>({ food: 0, arms: 0 });
  const [preview, setPreview] = useState<Partial<Record<Resource, number>>>({});
  const [exAmounts, setExAmounts] = useState({ foodToArms: 0, armsToFood: 0 });
  const [exPreview, setExPreview] = useState<Partial<{ foodToArms: number; armsToFood: number }>>({});

  const shown = (r: Resource) => preview[r] ?? amounts[r];
  const shownEx = (k: 'foodToArms' | 'armsToFood') => exPreview[k] ?? exAmounts[k];
  const other = (r: Resource): Resource => (r === 'food' ? 'arms' : 'food');
  // Buying shares one purse between both rows, so each row's max leaves
  // room for what the other has dialled in.
  const maxFor = (r: Resource) =>
    mode === 'sell'
      ? player[r]
      : Math.max(0, Math.floor((player.gold - shown(other(r)) * harvestBuyPrice(other(r))) / harvestBuyPrice(r)));

  const total = shown('food') + shown('arms');
  const goldDelta =
    mode === 'sell'
      ? shown('food') * harvestSellPrice('food') + shown('arms') * harvestSellPrice('arms')
      : -(shown('food') * harvestBuyPrice('food') + shown('arms') * harvestBuyPrice('arms'));

  const exTotalF2A = shownEx('foodToArms');
  const exTotalA2F = shownEx('armsToFood');
  const exActive = exTotalF2A > 0 || exTotalA2F > 0;

  const switchMode = (next: Mode) => {
    setMode(next);
    setAmounts({ food: 0, arms: 0 });
    setPreview({});
    setExAmounts({ foodToArms: 0, armsToFood: 0 });
    setExPreview({});
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

  const doExchange = () => {
    exchangeResource(player, 'food', exAmounts.foodToArms);
    exchangeResource(player, 'arms', exAmounts.armsToFood);
    setExAmounts({ foodToArms: 0, armsToFood: 0 });
    setExPreview({});
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

        <div className="harvest-mode">
          {(['buy', 'sell', 'exchange'] as const).map((m) => (
            <button
              key={m}
              className={'harvest-mode-button' + (mode === m ? ' harvest-mode-button--active' : '')}
              onClick={() => switchMode(m)}
            >
              {m === 'buy'
                ? t('harvest.buyMode')
                : m === 'sell'
                  ? t('harvest.sellMode')
                  : t('harvest.exchangeMode')}
            </button>
          ))}
        </div>

        {mode !== 'exchange' &&
          RESOURCES.map((r) => (
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

        {mode === 'exchange' &&
          RESOURCES.map((from) => {
            const key = EX_KEY[from];
            const { give, get } = exchangeBatch(from);
            const max = maxExchangeBatches(player, from);
            return (
              <div key={from} className="hire-row">
                <div className="hire-row-name harvest-exchange-from">
                  {resourceLabel(from, '')}
                  <span className="harvest-exchange-rate">
                    {give}:{get}
                  </span>
                </div>
                <DecoratedSlider
                  min={0}
                  max={max}
                  value={Math.min(shownEx(key), max)}
                  disabled={max === 0}
                  onPreview={(v) => setExPreview((p) => ({ ...p, [key]: v }))}
                  onCommit={(v) => {
                    setExAmounts((a) => ({ ...a, [key]: v }));
                    setExPreview((p) => ({ ...p, [key]: undefined }));
                  }}
                />
                <div className="hire-row-amount-label">{resourceLabel(other(from), shownEx(key) * get)}</div>
              </div>
            );
          })}

        <div className="harvest-trade">
          {mode !== 'exchange' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ transform: 'scale(1.25)', transformOrigin: 'center' }}>
                <div
                  className={
                    'big-shield-button-container' +
                    (total > 0 ? '' : ' shield-button-container--disabled')
                  }
                >
                  <button
                    className="big-shield-button hire-submit"
                    onClick={trade}
                    disabled={total <= 0}
                    title={t('harvest.trade')}
                  >
                    <span className="hire-submit-icon">{mode === 'buy' ? '👛' : '⚖️'}</span>
                  </button>
                </div>
              </div>
              <span className="hire-row-caption">
                <Gold amount={goldDelta > 0 ? `+${goldDelta}` : goldDelta} />
              </span>
            </div>
          ) : (
            <div style={{ transform: 'scale(1.25)', transformOrigin: 'center' }}>
              <div
                className={
                  'big-shield-button-container' +
                  (exActive ? '' : ' shield-button-container--disabled')
                }
              >
                <button
                  className="big-shield-button hire-submit"
                  onClick={doExchange}
                  disabled={!exActive}
                >
                  <span className="hire-submit-icon">🔄</span>
                </button>
              </div>
            </div>
          )}
        </div>

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
