export interface MenuState {
  type: 'main' | 'buy' | 'fee-or-fight' | 'wait' | 'move-result';
  tileIdx?: number;
  diceRoll?: number;
  passedStart?: boolean;
  specialReward?: { type: 'gold' | 'units'; amount: number };
}


