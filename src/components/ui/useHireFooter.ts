import { useRef, useState } from 'react';
import { UnitTier } from '../../game/army';

/**
 * Lets a dialogue's footer button mirror SquadHirePanel's sliders and buy
 * through them -- pass `onAmountChange`/`registerBuy` to the panel. Amounts
 * are state (so the label re-renders), the rows' buy functions a ref
 * (closures that change every render).
 *
 * `panelShown`: a purchase that maxes out gold or the army swaps the panel
 * out in the same render, so its sliders never report their reset to 0 --
 * amounts only count while the panel is actually on screen.
 */
export function useHireFooter(panelShown: boolean) {
  const [pending, setPending] = useState<Partial<Record<UnitTier, number>>>({});
  const buyRefs = useRef<Partial<Record<UnitTier, () => void>>>({});

  const onAmountChange = (tier: UnitTier, amount: number) => {
    setPending((s) => (s[tier] === amount ? s : { ...s, [tier]: amount }));
  };

  const registerBuy = (tier: UnitTier, buy: () => void) => {
    buyRefs.current[tier] = buy;
  };

  const clear = (tier: UnitTier) => setPending((s) => (s[tier] ? { ...s, [tier]: 0 } : s));

  const amountOf = (tier: UnitTier): number => (panelShown ? (pending[tier] ?? 0) : 0);

  const buy = (tier: UnitTier) => {
    buyRefs.current[tier]?.();
    clear(tier);
  };

  return { amountOf, onAmountChange, registerBuy, clear, buy };
}
