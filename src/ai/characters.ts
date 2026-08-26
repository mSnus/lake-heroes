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
  /** When to take optional payback on a tile whose toll has already been
   * paid (see ai/decisions.ts's shouldSeekRevenge). Both conditions must
   * hold: the army must be `powerRatio` times the tile's defence, AND its
   * armyPower must exceed `minPower` -- otherwise the bot walks away. */
  revenge: { powerRatio: number; minPower: number };
  dragonThreshold: number;
  kingsCastleHireFraction: number; // unused by 'wizard' strategy, see pickKingsCastleHireAmount
  buildsSyndicates: boolean;
  /** When (and how hard) the bot tops up its under-garrisoned owned tiles
   * each turn -- see pickGarrisonAction. Garrisoning only starts once the
   * character's trigger is met; `budgetFraction` then caps how much of the
   * turn's starting militia may go into it, and omitting it means "fill to
   * the top", limited only by tile capacity and militia on hand. */
  garrison: {
    /** Requires MORE than this many traveling militia. */
    minMilitia?: number;
    /** Requires at least this many units of per-turn tile income (uncapped
     * by squad room -- see game/income.ts's playerRawTurnIncome). */
    minUnitIncome?: number;
    budgetFraction?: number;
  };
  // Fraction of Militia left behind (capped by the tile's slot capacity) the
  // moment a bot claims a tile — see TileClaimScreen's bot auto-dismiss effect.
  claimGarrisonFraction: number;
  // Skip buying a tile (unless it completes a syndicate) when the dragon-
  // challenge goal is reachable within ~3 laps on current income alone.
  skipBuyingNearDragonGoal: boolean;
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
    revenge: { powerRatio: 2, minPower: 0 },
    // Same flat threshold as DRAGON_UNITS_THRESHOLD (see fightDragon.ts) --
    // the 60-unit army slot cap leaves no room for a per-character spread,
    // since anything above ~120 armyPower is already unreachable.
    dragonThreshold: 120,
    kingsCastleHireFraction: 0.5,
    buildsSyndicates: true,
    skipBuyingNearDragonGoal: false,
    garrison: { minMilitia: 3 },
    claimGarrisonFraction: 0.7,
  },
  warrior: {
    id: 'warrior',
    label: '⚔️ Warrior',
    claim: { type: 'chance', chance: 0.85 },
    upgrade: { goldFraction: 1 / 3, unitsFraction: 1 / 3, maxPerTurn: 1 },
    fightThreshold: { heroHour: 1.5, caravan: 1.5 },
    revenge: { powerRatio: 1.5, minPower: 20 },
    dragonThreshold: 120,
    kingsCastleHireFraction: 2 / 3,
    buildsSyndicates: false,
    skipBuyingNearDragonGoal: true,
    garrison: { minMilitia: 8, budgetFraction: 2 / 3 },
    claimGarrisonFraction: 0.3,
  },
  wizard: {
    id: 'wizard',
    label: '🧙 Wizard',
    claim: { type: 'afford-no-banzai' },
    upgrade: { goldFraction: 1 / 3, unitsFraction: 1 / 3, maxPerTurn: 2 },
    fightThreshold: { heroHour: 1.7, caravan: 1.7 },
    revenge: { powerRatio: 2.2, minPower: 20 },
    dragonThreshold: 120,
    kingsCastleHireFraction: 1, // unused — pickKingsCastleHireAmount special-cases wizard
    buildsSyndicates: true,
    skipBuyingNearDragonGoal: true,
    garrison: { minUnitIncome: 2 },
    claimGarrisonFraction: 0.5,
  },
};
