export interface MenuState {
  type: 'main' | 'upgrade-list' | 'buy' | 'fee-or-fight' | 'wait' | 'move-result';
  tileIdx?: number;
  diceRoll?: number;
  passedStart?: boolean;
}


