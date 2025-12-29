export interface MenuState {
  type: 'main' | 'fee-or-fight' | 'wait' | 'end-turn' | 'buy-units' | 'sell-to-pay';
  tileIdx?: number;
  diceRoll?: number;
  passedStart?: boolean;
  specialReward?: { type: 'gold' | 'units'; amount: number };
}
