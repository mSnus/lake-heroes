export type CharacterId = 'explorer' | 'warrior' | 'wizard';

export interface CharacterConfig {
  id: CharacterId;
  label: string;
  claim:
    | { type: 'threshold'; armyFraction: number; goldFraction: number }
    | { type: 'chance'; chance: number }
    | { type: 'afford-no-banzai' };
  upgrade: { goldFraction: number; unitsFraction: number; maxPerTurn: number };
  fightThreshold: { heroHour: number; caravan: number };
  guards:
    | { strategy: 'last-resort-fight' } // explorer: fight only as a last resort
    | { strategy: 'prefer-fight' } // warrior: always fight when able
    | { strategy: 'wizard' }; // wizard: weighted priority list, see ai/wizardGuards.ts
  dragonThreshold: number;
  kingsCastleHireFraction: number; // unused by 'wizard' strategy, see pickKingsCastleHireAmount
  buildsSyndicates: boolean;
}

// Appended to a bot's name once the game starts, so it's visible in-game but
// not editable in the NewGameModal name field.
export const CHARACTER_EMOJI: Record<CharacterId, string> = {
  explorer: '🧑‍🌾',
  warrior: '💂',
  wizard: '🧙',
};

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  explorer: {
    id: 'explorer',
    label: '🧭 Explorer',
    claim: { type: 'threshold', armyFraction: 2 / 3, goldFraction: 2 / 3 },
    upgrade: { goldFraction: 1 / 2, unitsFraction: 1 / 2, maxPerTurn: 1 },
    fightThreshold: { heroHour: 2, caravan: 2 },
    guards: { strategy: 'last-resort-fight' },
    dragonThreshold: 70,
    kingsCastleHireFraction: 0.5,
    buildsSyndicates: true,
  },
  warrior: {
    id: 'warrior',
    label: '⚔️ Warrior',
    claim: { type: 'chance', chance: 0.85 },
    upgrade: { goldFraction: 1 / 3, unitsFraction: 1 / 3, maxPerTurn: 1 },
    fightThreshold: { heroHour: 1.5, caravan: 1.5 },
    guards: { strategy: 'prefer-fight' },
    dragonThreshold: 50,
    kingsCastleHireFraction: 2 / 3,
    buildsSyndicates: false,
  },
  wizard: {
    id: 'wizard',
    label: '🧙 Wizard',
    claim: { type: 'afford-no-banzai' },
    upgrade: { goldFraction: 1 / 3, unitsFraction: 1 / 3, maxPerTurn: 2 },
    fightThreshold: { heroHour: 1.7, caravan: 1.7 },
    guards: { strategy: 'wizard' },
    dragonThreshold: 60,
    kingsCastleHireFraction: 1, // unused — pickKingsCastleHireAmount special-cases wizard
    buildsSyndicates: true,
  },
};
