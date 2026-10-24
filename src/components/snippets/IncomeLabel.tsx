import React from 'react';
import { TileIncome } from '../../game/income';
import { Gold } from './Gold';
import { Food } from './Food';
import { Arms } from './Arms';
import { Militia } from './Militia';

interface IncomeLabelProps {
  income: Partial<TileIncome>;
  /** Player color key for the militia sprite. */
  unitColor?: string;
  /** Owner is a Knight -- the militia sprite shows as a footman. */
  unitKnight?: boolean;
}

/** "+N" for every nonzero part of an income, in gold/food/arms/units order. */
export const IncomeLabel: React.FC<IncomeLabelProps> = ({ income, unitColor, unitKnight }) => (
  <>
    {(income.gold ?? 0) > 0 && <Gold amount={`+${income.gold}`} />}
    {(income.food ?? 0) > 0 && <Food amount={`+${income.food}`} />}
    {(income.arms ?? 0) > 0 && <Arms amount={`+${income.arms}`} />}
    {(income.units ?? 0) > 0 && <Militia amount={`+${income.units}`} color={unitColor} knight={unitKnight} />}
  </>
);

export const hasIncome = (income: Partial<TileIncome>): boolean =>
  (income.gold ?? 0) > 0 || (income.food ?? 0) > 0 || (income.arms ?? 0) > 0 || (income.units ?? 0) > 0;

export default IncomeLabel;
