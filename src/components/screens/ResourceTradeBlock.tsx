import React, { useState } from 'react';
import {
  Resource,
  tradeResource,
  harvestBuyPrice,
  harvestSellPrice,
  exchangeBatch as defaultExchangeBatch,
  exchangeResource,
  maxExchangeBatches,
} from '../../game/resources';
import { Player } from '../../game/Player';
import { DecoratedSlider } from '../ui/DecoratedSlider';
import { Gold } from '../snippets/Gold';
import { Food } from '../snippets/Food';
import { Arms } from '../snippets/Arms';
import { useT } from '../../i18n';
import '../../styles/HarvestModal.css';

type Mode = 'buy' | 'sell' | 'exchange';

const RESOURCES: Resource[] = ['food', 'arms'];
const EX_KEY = { food: 'foodToArms', arms: 'armsToFood' } as const;

interface ResourceTradeBlockProps {
  player: Pick<Player, 'gold' | 'food' | 'arms'>;
  /** Called after any trade/exchange mutates `player` in place, to persist
   * and re-render. */
  onTrade: () => void;
  /** Per-resource gold prices -- default to the Harvest's own fixed rates.
   * Traveling Traders (see actions/workersEncounter.tsx) halves the buy
   * price and doubles the sell price of whichever resource it's bargaining
   * on. */
  buyPrice?: (r: Resource) => number;
  sellPrice?: (r: Resource) => number;
  /** Exchange batch size for `from` -- defaults to the Harvest's own 3:2
   * rate. Traveling Traders passes a flat 1:1 rate instead. */
  exchangeBatch?: (from: Resource) => { give: number; get: number };
}

/**
 * The buy/sell/exchange trading block shared by the Harvest screen
 * (HarvestModal) and the Traveling Traders encounter (TravelingTradersModal)
 * -- identical UI and mechanics, just different prices/rates passed in.
 */
export const ResourceTradeBlock: React.FC<ResourceTradeBlockProps> = ({
  player,
  onTrade,
  buyPrice = harvestBuyPrice,
  sellPrice = harvestSellPrice,
  exchangeBatch = defaultExchangeBatch,
}) => {
  const t = useT();
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
      : Math.max(0, Math.floor((player.gold - shown(other(r)) * buyPrice(other(r))) / buyPrice(r)));

  const total = shown('food') + shown('arms');
  const goldDelta =
    mode === 'sell'
      ? shown('food') * sellPrice('food') + shown('arms') * sellPrice('arms')
      : -(shown('food') * buyPrice('food') + shown('arms') * buyPrice('arms'));

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
      if (n > 0) tradeResource(player, r, mode === 'buy' ? n : -n, buyPrice(r), sellPrice(r));
    }

    setAmounts({ food: 0, arms: 0 });
    setPreview({});
    onTrade();
  };

  const doExchange = () => {
    exchangeResource(player, 'food', exAmounts.foodToArms, exchangeBatch('food'));
    exchangeResource(player, 'arms', exAmounts.armsToFood, exchangeBatch('arms'));
    setExAmounts({ foodToArms: 0, armsToFood: 0 });
    setExPreview({});
    onTrade();
  };

  const resourceLabel = (r: Resource, amount: number | string) =>
    r === 'food' ? <Food amount={amount} /> : <Arms amount={amount} />;

  return (
    <>
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
          const max = maxExchangeBatches(player, from, exchangeBatch(from));
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
                  'big-shield-button-container' + (total > 0 ? '' : ' shield-button-container--disabled')
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
              className={'big-shield-button-container' + (exActive ? '' : ' shield-button-container--disabled')}
            >
              <button className="big-shield-button hire-submit" onClick={doExchange} disabled={!exActive}>
                <span className="hire-submit-icon">🔄</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ResourceTradeBlock;
