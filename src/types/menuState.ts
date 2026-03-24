export interface MenuState {
  type: 'main' | 'fee-or-fight' | 'wait' | 'end-turn' | 'buy-units' | 'sell-to-pay' | 'dragon-challenge' | 'fight-win' | 'fight-lose';
  tileIdx?: number;
  diceRoll?: number;
  passedStart?: boolean;
  specialReward?: { type: 'gold' | 'units'; amount: number };
}
