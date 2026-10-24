export const MONEY_START = 150;
export const UNITS_START = 12;
export const MONEY_PASS_START = 200;
export const UNITS_PASS_START = 6;
export const FEE_MULTIPLIER = 5;
export const TREASURE_BOX_MULTIPLIER = 20;
export const TILE_COUNT = 28;
export const MAX_PLAYERS = 6;
// How big an ownable tile is drawn on the map, by level -- so an upgrade is
// visible at a glance. Purely visual: nothing reads it but BoardCanvas.
export const TILE_LEVEL_SCALE: Record<number, number> = { 1: 0.8, 2: 1, 3: 1.2 };
export const REVEAL_GOLD_PER_YEAR = 25; // discovery bonus scales with how many years the game has run
// Board fork: leaving FORK_START_INDEX branches onto either the short or the
// long path, which rejoin the main loop at FORK_MERGE_INDEX -- see
// game/boardPath.ts (movement), utils/forkChoiceStore.ts (the pending
// per-turn choice), and BoardCanvas.tsx (the on-tile arrow picker).
export const FORK_START_INDEX = 3;
export const FORK_MERGE_INDEX = 13;
export const FORK_SHORT_PATH = [4, 5, 6];
export const FORK_LONG_PATH = [7, 8, 9, 10, 11, 12];
// Approaching the fork, the branch is a hidden coin flip rather than a
// choice -- rolled in rollAndMove.ts whenever the fork start is this many
// steps away or fewer, i.e. whenever a single die could still reach it. A
// player standing exactly ON the fork tile picks by hand instead.
export const FORK_ROLL_RANGE = 6;
// A year is this many turns per player -- the shared clock every player
// moves along at the same rate, counted in go-rounds (board.round, bumped
// once the last player's turn ends) rather than laps of the board, so a
// turn spent in prison still passes the time. See game/year.ts.
export const TURNS_PER_YEAR = 8;
// This year's lucky groups: each rolled independently at DOUBLE_INCOME_CHANCE
// in startNewYear, capped at DOUBLE_INCOME_MAX_GROUPS. Only gold-producing
// groups -- doubling a Camp/Tower's unit income isn't the same kind of
// windfall and would need its own balance pass.
export const DOUBLE_INCOME_GROUPS = ['Mills', 'Farms', 'Fields'];
export const DOUBLE_INCOME_CHANCE = 0.25;
export const DOUBLE_INCOME_MAX_GROUPS = 2;
// While the game is still in its first this many years, it counts as a
// "getting started" phase -- the long path's hidden coin flip
// (rollAndMove.ts) is forced short rather than risk stranding a brand-new
// player on the longer route, and Joker's Queen's Gift (joker.ts) falls
// back to gold instead of a Camp/Tower for the same reason. Reused
// wherever "is this still early game" needs an answer.
export const REAL_ADVENTURE_MIN_TURNS = 3;
// Joker's Hurricane only strikes the richest player, and only when they're
// this many times wealthier than whoever ranks second -- a check on a
// runaway leader, not a routine hazard for everyone (see actions/joker.ts).
export const HURRICANE_WEALTH_RATIO = 1.5;

// ── Karma ──
// A clandestine per-player moral-standing counter (see utils/karma.ts) --
// never announced, shown only as a 🕷️ marker beside a player's name once it
// goes negative. Only negative karma biases anything; these are the shared
// knobs every biasing site reads.
// Chance the Portal drops a cursed player straight into Prison instead of a
// random tile, and the same chance a die roll within Prison's reach is
// quietly overridden to land exactly on it (see portal.ts, rollAndMove.ts).
export const KARMA_PRISON_CHANCE = 0.05;
// A cursed player's Joker draw is this likely to come from the bad half of
// the event table instead of the normal 50/50 (see joker.ts).
export const KARMA_JOKER_BAD_CHANCE = 0.8;
// A cursed player's hidden fork coin flip favours the long path at this
// rate instead of the normal 50/50 (see rollAndMove.ts).
export const KARMA_LONG_PATH_CHANCE = 0.75;
// A cursed player's chance of a roaming-horde (rogue) attack or an ambush is
// multiplied by this -- a +125% increase over the normal odds (see
// rogueAttackEncounter.ts, ambushEncounter.tsx).
export const KARMA_HOSTILE_ENCOUNTER_MULTIPLIER = 2.25;

// ── Tile economy scale ──
// tiles.json authors prices and income as small coefficients of these bases,
// materialised into real gold in the Tile constructor. Change one number here
// to rescale the whole economy. TILE_BASE_PRICE scales a tile's purchase price
// (level-1 gold), TILE_BASE_UPGRADE its upgrade costs (level-2/3 gold), and
// TILE_BASE_INCOME its per-turn gold income (bonuses on gold-type tiles).
export const TILE_BASE_PRICE = 20;
export const TILE_BASE_UPGRADE = TILE_BASE_PRICE * 2;
export const TILE_BASE_INCOME = TILE_BASE_PRICE * 2;
// Multiplier on TILE_BASE_UPGRADE's normal rate for the final upgrade (to
// level 3). At 1 the last upgrade costs the same rate as level 2.
export const LEVEL_3_UPGRADE_MULT = 1;
// Gold-type tile bonuses (Mills/Farms/Fields/Traders income) are cut by 35%
// off their raw TILE_BASE_INCOME-scaled value -- a deliberate income nerf
// independent of TILE_BASE_PRICE, which stays at its full value for
// purchase/upgrade costs.
export const BONUS_GOLD_RATIO = 0.8;
// A tile's own income (gold for Mills/Farms/Fields/Traders, units for Camps/
// Towers) pays out every turn now, not once a lap -- a turn's worth is a
// small slice of what the old per-year figure was. Applied on top of
// BONUS_GOLD_RATIO, with the rounding step shrinking from 100 to 50 to
// match (see Tile.ts's `bonuses` getter).
export const TURN_INCOME_RATIO = 0.1;
// Flat per-tile bonus each owned tile grants the King's-grace reward (once a
// lap, on top of its own per-turn income -- see kingsGrace.ts's
// computeAnnualReward), in whichever resource its own bonus ISN'T: a
// gold-bonus tile (Mills/Farms/Fields/Traders) always brings
// ANNUAL_DEFAULT_UNITS militia. A units-bonus tile (Camps/Towers) brings
// gold instead -- its own tiles.json entry (annualGoldMult, a multiple of
// TILE_BASE_PRICE so it rescales with a live tile-price override the same
// way prices/bonuses do) sets how much, defaulting to
// ANNUAL_DEFAULT_GOLD_MULT when unset. It may also earn extra units on top
// (tiles.json's annualUnits, per level) -- see Tile.ts's annualGold getter.
export const ANNUAL_DEFAULT_UNITS = 0;
export const ANNUAL_DEFAULT_GOLD_MULT = 2.5;
//adjustments for the King's grace reward
export const GRACE_TOTAL_UNITS_MULT = 0.5;
export const GRACE_TOTAL_GOLD_MULT = 0.5;
// Calling in on your own tile pays a multiple of its daily bonus -- the
// reward for spending the turn there rather than moving on (see
// actions/visitOwnTile.ts). Units get the bigger multiple since passing
// King's Castle (passStart.ts) already pays every owned tile's full gold
// income at once, but units only ever come from a personal visit or Grace.
export const VISIT_GOLD_MULT = 2;
export const VISIT_UNITS_SHARE = 5;

// A unit costs gold, food and arms (King's Castle prices; the Tavern doubles
// only the gold part -- see TAVERN_PRICE_MULT).
export const UNIT_PRICE = 20; // gold per militia unit
export const MILITIA_FOOD = 10;
// Each player's opening stock, enough to hire a few militia before their
// own tiles produce any.
export const FOOD_START = 30;
export const ARMS_START = 30;
export const MILITIA_ARMS = 10;
// Food/arms trade at the yearly Harvest (see components/screens/HarvestModal.tsx).
export const HARVEST_BUY_PRICE = 2; // gold per food/arms bought
export const HARVEST_SELL_PRICE = 1; // gold per food/arms sold
// The Tavern charges a premium over the King's Castle's own prices, for both
// hiring and squad upgrades -- a night of drinking recruits costs more than
// the crown's standing offer.
export const TAVERN_PRICE_MULT = 2;
export const DRAGON_UNITS = 48; // how many units the Dragon fields
export const DRAGON_GOLD = 10000; // dragon's hoard, awarded on victory
// The dragon spares the weakest player's holdings once the strongest is
// this many times ahead on power score -- the mirror of the Joker's
// HURRICANE_WEALTH_RATIO, which punishes a runaway leader. Only the
// tile-burning attack is skipped; a weakest player strong enough to fight
// is still offered the challenge (see actions/dragonEncounter.ts).
export const DRAGON_MERCY_SCORE_RATIO = 1.5;
export const KNIGHT_FAME = 7; // fame at or above this makes a player eligible for knighthood, granted on next King's Castle crossing (Player.isKnight) — which is what actually switches the rider sprite and unlocks Rider recruiting
export const BANZAI_THRESHOLD = 0.9; // risky banzai mode triggers when the attacker's army power is below this fraction of the tile's defence

// Army composition (Riders): a second, pricier unit tier unlocked at KNIGHT_FAME.
export const RIDER_UNIT_PRICE = 40; // gold per rider
export const RIDER_FOOD = 20;
export const RIDER_ARMS = 30;
// How much one unit of each kind is worth on a single strength scale, in
// militia. Everything that rates a force -- AI decisions, the Banzai
// threshold, the tile-card strength readout -- measures with these, so the
// four kinds stay directly comparable (see army.ts's forcePower).
//
// Fitted to the authored equivalences 10 riders = 22 militia,
// 9 riders = 11 zombies = 7 dragons, 22 militia = 9 zombies = 7 dragons.
// Those over-determine the scale and don't quite agree -- they imply three
// different rider:militia rates (2.20 stated directly, 2.44 via dragons,
// 2.99 via zombies) -- so the rider rate, the one stated twice and
// consistently, is taken as the anchor and the other two are the best fit
// between their two readings. That lands 22 militia + 9 riders at 13.9
// dragons, i.e. the intended 14.
export const MILITIA_POWER_WEIGHT = 1;
// Single source of truth for "how much a Rider is worth vs a Militia" --
// used both for army-power strength ratings (computeArmyPower) and as the
// roll multiplier a Rider gets in an actual battle duel.
export const RIDER_DUEL_MULTIPLIER = 2.2;
/** An abandoned tile's wild garrison guards as zombies -- tougher per head. */
export const ZOMBIE_POWER_WEIGHT = 2.1;
export const DRAGON_POWER_WEIGHT = 3;
export const GARRISON_SLOT_CAPACITY = 8;
// Every tile holds this many garrison slots beyond its level, so capacity
// runs 16/24/32 by level rather than 8/16/24 (see Tile.ts's garrisonSlots).
export const GARRISON_BONUS_SLOTS = 1;
// Defence is absorption rather than a counter-roll: the defender rolls for
// what share of an incoming hit it soaks (see engine.ts's rollAbsorption).
// A garrison stationed on a tile adds that tile's level to the roll, and
// these groups -- the ones built to hold soldiers -- add one more on top.
// Each point is worth 10% more of every hit absorbed.
export const FORTIFIED_TILE_GROUPS = ['Camps', 'Towers'];
// Absorbed share for each point of the second-stage roll: a roll of r
// soaks ABSORB_PER_ROLL_POINT * r + ABSORB_BASE of the damage.
export const ABSORB_PER_ROLL_POINT = 0.1;
export const ABSORB_BASE = 0.2;
// Energy: a unit's attack stamina (see GridUnit.energy, engine.ts's
// energyFor) -- militia tire faster than every other kind, and a unit with
// none left still swings, just cut to this fraction of its usual roll.
export const MILITIA_ENERGY = 3;
export const OTHER_KIND_ENERGY = 5;
export const ENERGY_DEPLETED_DAMAGE_MULT = 0.3;
// Army caps by fame, per tier, highest fame first. They cap future growth
// only -- a fame drop never claws back units already raised.
export const MILITIA_CAP_BY_FAME: { minFame: number; cap: number }[] = [
  { minFame: 16, cap: 60 },
  { minFame: 13, cap: 40 },
  { minFame: 10, cap: 32 },
  { minFame: 6, cap: 20 },
  { minFame: 3, cap: 16 },
  { minFame: 0, cap: 12 },
];
// Knights only -- a non-knight's rider cap is always 0 (see Player.armyCapacity),
// so the bottom row is what a fresh Knight gets right away.
export const RIDER_CAP_BY_FAME: { minFame: number; cap: number }[] = [
  { minFame: 20, cap: Infinity },
  { minFame: 18, cap: 32 },
  { minFame: 16, cap: 24 },
  { minFame: 13, cap: 16 },
  { minFame: 11, cap: 12 },
  { minFame: 0, cap: 8 },
];

export const SPRITE_SIZE = 96;

// ── Grid battle (BattlefieldGrid) ──
// Every battle is fought on this one corridor-shaped board.
export const BATTLEFIELD_COLS = 9;
export const BATTLEFIELD_ROWS = 11;
// Units each side opens the battle with; the rest wait in reserve and enter
// at that side's own edge column whenever a cell there is free.
export const BATTLE_START_UNITS = 12;
// Landing on an abandoned (zombie-guarded) tile has this chance to trigger a
// zombie ambush — same mechanics as a regular Ambush, but the attackers are
// zombies drawn from the tile's own garrison (see zombieAmbushEncounter.ts).
export const ZOMBIE_AMBUSH_CHANCE = 0.3;
export const ZOMBIE_AMBUSH_FORCE_RATIO = 2 / 3;
export const MILITIA_HP = 6;
export const MILITIA_DMG_MIN = 4;
export const MILITIA_DMG_MAX = 8;
export const RIDER_HP = 12;
export const RIDER_DMG_MIN = 8;
export const RIDER_DMG_MAX = 18;
// The dragon fights as its own kind, not a rider -- always exactly DRAGON_UNITS.
export const DRAGON_HP = 25;
export const DRAGON_DMG_MIN = 2;
export const DRAGON_DMG_MAX = 20;
// Per-side cap on how many real militia/riders get their own grid unit —
// above this, army composition is proportionally downscaled (see
// game/battleGrid/scale.ts).
export const MAX_GRID_ARMY_SIZE = 150;

// Abandoned tiles (razed, never reclaimed) are guarded by Zombies instead of
// regular militia — their own stats, not a multiple of militia's (the damage
// range needed a different factor at each end, so multipliers couldn't express it).
export const ZOMBIE_HP = 10;
export const ZOMBIE_DMG_MIN = 6;
export const ZOMBIE_DMG_MAX = 18;
