export interface MenuState {
  type: 'main' | 'fee-or-fight' | 'wait' | 'end-turn' | 'buy-units' | 'sell-to-pay' | 'dragon-challenge' | 'fight-win' | 'fight-lose' | 'sphynx-waiting' | 'sphynx-result' | 'tavern-waiting' | 'tavern-result' | 'treasure-waiting' | 'treasure-result' | 'prison-regular' | 'prison-beggar';
  tileIdx?: number;
  diceRoll?: number;
  passedStart?: boolean;
  specialReward?: { type: 'gold' | 'units'; amount: number };
}
