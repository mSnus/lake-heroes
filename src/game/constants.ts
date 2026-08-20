export const MONEY_START = 1500;
export const UNITS_START = 16;
export const MONEY_PASS_START = 500;
export const UNITS_PASS_START = 6;
export const MONEY_PASS_START_FAME = 200;
export const FAME_STEP = 3;
export const FEE_MULTIPLIER = 50;
export const TREASURE_BOX_MULTIPLIER = 200;
export const TILE_COUNT = 28;
export const MAX_PLAYERS = 6;
export const REVEAL_GOLD_PER_CIRCLE = 250; // discovery bonus scales with the player's laps around the board
// Board fork (map13): leaving FORK_START_INDEX branches onto either the
// short or the long path, which rejoin the main loop at FORK_MERGE_INDEX --
// see game/boardPath.ts (movement) and utils/forkChoiceStore.ts (the pending
// per-turn choice) and BoardCanvas.tsx (the on-tile arrow picker).
export const FORK_START_INDEX = 5;
export const FORK_MERGE_INDEX = 13;
export const FORK_SHORT_PATH = [6, 7, 8];
export const FORK_LONG_PATH = [9, 10, 11, 12];
// Joker's Hurricane only strikes the richest player, and only when they're
// this many times wealthier than whoever ranks second -- a check on a
// runaway leader, not a routine hazard for everyone (see actions/joker.ts).
export const HURRICANE_WEALTH_RATIO = 1.5;

// ── Tile economy scale ──
// tiles.json authors prices and income as small coefficients of these bases,
// materialised into real gold in the Tile constructor. Change one number here
// to rescale the whole economy. TILE_BASE_PRICE scales a tile's purchase price
// (level-1 gold), TILE_BASE_UPGRADE its upgrade costs (level-2/3 gold), and
// TILE_BASE_INCOME its per-turn gold income (bonuses on gold-type tiles).
export const TILE_BASE_PRICE = 200;
export const TILE_BASE_UPGRADE = TILE_BASE_PRICE * 1;
export const TILE_BASE_INCOME = TILE_BASE_PRICE * 1;
// The final upgrade (to level 3) costs extra on top of TILE_BASE_UPGRADE's
// normal rate -- level 2 is unaffected, only level 3's gold price doubles.
export const LEVEL_3_UPGRADE_MULT = 2;
// Gold-type tile bonuses (Mills/Farms/Fields/Traders income) are cut by 35%
// off their raw TILE_BASE_INCOME-scaled value -- a deliberate income nerf
// independent of TILE_BASE_PRICE, which stays at its full value for
// purchase/upgrade costs.
export const BONUS_GOLD_RATIO = 0.65;
// A tile's own income (gold for Mills/Farms/Fields/Traders, units for Camps/
// Towers) pays out every turn now, not once a lap -- a turn's worth is a
// small slice of what the old per-year figure was. Applied on top of
// BONUS_GOLD_RATIO, with the rounding step shrinking from 100 to 50 to
// match (see Tile.ts's `bonuses` getter).
export const TURN_INCOME_RATIO = 0.1;
// Flat per-tile bonus each owned tile grants the King's-grace reward (once a
// lap, on top of its own per-turn income -- see kingsGrace.ts's
// computeAnnualReward), in whichever resource its own bonus ISN'T: a
// gold-bonus tile (Mills/Farms/Fields/Traders) also brings
// ANNUAL_DEFAULT_UNITS militia, a units-bonus tile (Camps/Towers) also
// brings ANNUAL_DEFAULT_GOLD gold -- same flat amount for every units-bonus
// tile. Towers additionally earn a level-scaled UNIT toll on top of this
// (added to tileUnits, not tileGold) -- see TOWER_LEVEL_UNIT_BONUS.
export const ANNUAL_DEFAULT_UNITS = 0;
export const ANNUAL_DEFAULT_GOLD = 2.5 * TILE_BASE_PRICE;
// Every owned tile also brings in a flat militia trickle every turn, on top
// of whatever its own bonus produces (gold-type tiles) or in addition to it
// (units-type tiles) -- see game/income.ts's tileTurnIncome.
export const FLAT_TILE_UNIT_INCOME = 1;
// Towers additionally levy a yearly UNIT toll toward the King's-grace
// reward, scaled by their fortification level (1/2/3) -- a garrison drawn
// from the tower's own recruits at higher fortification, on top of their
// own per-turn unit bonus (tiles.json's archer/arquebus/cannon-tower
// bonuses, 1/1/2 by level) plus the universal FLAT_TILE_UNIT_INCOME every
// tile gets. They still get the universal ANNUAL_DEFAULT_GOLD trickle every
// units-bonus tile earns too, just no *extra* level-scaled gold on top of it.
export const TOWER_LEVEL_UNIT_BONUS = 2;

export const UNIT_PRICE = 200; // gold per militia unit (King's Castle recruit price)
export const DRAGON_UNITS = 50; // units on each side of the dragon battle
export const DRAGON_GOLD = 100000; // dragon's hoard, awarded on victory
export const KNIGHT_FAME = 7; // fame at or above this makes a player eligible for knighthood, granted on next King's Castle crossing (Player.isKnight) — which is what actually switches the rider sprite and unlocks Rider recruiting
export const BRAWL_THRESHOLD = 10; // defence at or below this triggers brawl mode (manual duel-by-duel rounds)

// Army composition (Riders): a second, pricier unit tier unlocked at KNIGHT_FAME.
export const RIDER_UNIT_PRICE = 500; // gold per rider
export const MILITIA_POWER_WEIGHT = 1;
// Single source of truth for "how much a Rider is worth vs a Militia" --
// used both for army-power strength ratings (computeArmyPower) and as the
// roll multiplier a Rider gets in an actual battle duel.
export const RIDER_DUEL_MULTIPLIER = 1.5;
export const ARMY_SLOT_CAPACITY = 10; // max units of one tier per slot
// A tile garrison's own per-slot cap -- independent of ARMY_SLOT_CAPACITY
// (see overridesStore.ts's armySlotCapacity/garrisonSlotCapacity split).
export const GARRISON_SLOT_CAPACITY = 8;
export const MAX_ARMY_SLOTS = 5;
// Fame thresholds for army slots: 0-2 fame -> 2 slots, 3-5 -> 3, 6-9 -> 4, 10+ -> 5.
// Uneven bracket widths, so this is a lookup table, not a uniform step size.
export const ARMY_SLOT_FAME_THRESHOLDS: { minFame: number; slots: number }[] = [
  { minFame: 10, slots: MAX_ARMY_SLOTS },
  { minFame: 6, slots: 4 },
  { minFame: 3, slots: 3 },
  { minFame: 0, slots: 2 },
];

export const SPRITE_SIZE = 96;

// ── Grid battle (BattlefieldGrid) ──
export const BATTLEFIELD_COLS = 11;
// 16, not 13: a maxed-out 5-squad, 40-unit army (the AUTO_BATTLE_LARGE_THRESHOLD
// case below) needs 16 rows to lay out without squads clamping into overlap.
export const BATTLEFIELD_ROWS = 16;
// An automatic (non-brawl) battle gets bigger cells/units when both sides
// field at most this many grid units -- easier to read a small fight without
// needing the full battlefield's tight packing.
export const AUTO_BATTLE_LARGE_THRESHOLD = 40;
// Below this, an automatic battle also gets a shorter board (SMALL_BATTLEFIELD_
// ROWS instead of BATTLEFIELD_ROWS). A real army's squads are always
// front-loaded per tier (each slot filled to capacity before the next starts),
// so a total under 30 can never actually split into more than 4 non-empty
// squads (verified by enumeration) -- one fewer than the 5 a 30-40 army can
// reach, which is why this band tolerates a shorter board than BATTLEFIELD_ROWS.
// Width can't shrink the same way: two wide single-tier armies (e.g. both
// all-militia) can still need the full BATTLEFIELD_COLS to keep their
// formations from touching at the center gap, verified by exhaustive search
// over every real militia/riders split under 30 -- so cols matches the
// standard board and only rows gets smaller.
export const SMALL_AUTO_BATTLE_THRESHOLD = 30;
export const SMALL_BATTLEFIELD_COLS = BATTLEFIELD_COLS;
export const SMALL_BATTLEFIELD_ROWS = 15;
// Landing on an abandoned (zombie-guarded) tile has this chance to trigger a
// zombie ambush — same mechanics as a regular Ambush, but the attackers are
// zombies drawn from the tile's own garrison (see zombieAmbushEncounter.ts).
export const ZOMBIE_AMBUSH_CHANCE = 0.3;
export const ZOMBIE_AMBUSH_FORCE_RATIO = 2 / 3;
// Repelling a zombie ambush thins out the tile's own wild garrison by this
// fraction (rounded, but never down to 0 -- some zombies always survive to
// guard it) -- see resolveAmbush.ts.
export const ZOMBIE_GARRISON_REPEL_RATIO = 0.5;
// Brawl (small skirmish): a compact board with larger cells, used for the
// turn-based / manually-controlled brawl fights instead of the full-size
// battlefield above. A battle is a brawl when both sides field at most
// BRAWL_THRESHOLD grid units.
export const BRAWL_COLS = 6;
export const BRAWL_ROWS = 7;
export const MILITIA_HP = 12;
export const MILITIA_DMG_MIN = 4;
export const MILITIA_DMG_MAX = 8;
export const RIDER_HP = 20;
export const RIDER_DMG_MIN = 6;
export const RIDER_DMG_MAX = 16;
// The dragon fights as its own kind, not a rider — see the 'dragon'
// formation in game/battleGrid/formations.ts, always exactly DRAGON_UNITS.
export const DRAGON_HP = 24;
export const DRAGON_DMG_MIN = 6;
export const DRAGON_DMG_MAX = 10;
// Per-side cap on how many real militia/riders get their own grid unit —
// above this, army composition is proportionally downscaled to fit the
// 16x20=320-cell battlefield (see game/battleGrid/scale.ts).
export const MAX_GRID_ARMY_SIZE = 150;

// Abandoned tiles (razed, never reclaimed) are guarded by Zombies instead of
// regular militia — same base militia stats, scaled by these multipliers.
export const ZOMBIE_HP_MULTIPLIER = 2;
export const ZOMBIE_DMG_MULTIPLIER = 1.5;
