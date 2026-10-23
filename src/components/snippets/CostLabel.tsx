import React from 'react';
import { Cost } from '../../game/resources';
import { Gold } from './Gold';
import { Food } from './Food';
import { Arms } from './Arms';

interface CostLabelProps {
  cost: Cost;
  /** Prefixed to every part, e.g. '+' for a refund or '-' for a payment. */
  sign?: string;
}

/** A cost's nonzero parts as Gold/Food/Arms snippets ("0" + coin when free). */
export const CostLabel: React.FC<CostLabelProps> = ({ cost, sign = '' }) => {
  if (!cost.gold && !cost.food && !cost.arms) return <Gold amount={0} />;
  return (
    <>
      {cost.gold > 0 && <Gold amount={`${sign}${cost.gold}`} />}
      {cost.food > 0 && <Food amount={`${sign}${cost.food}`} />}
      {cost.arms > 0 && <Arms amount={`${sign}${cost.arms}`} />}
    </>
  );
};

export default CostLabel;
