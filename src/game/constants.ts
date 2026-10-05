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
export const TILE_LEVEL_SCALE: Record<number, number> = { 1: 0.9, 2: 1, 3: 1.1 };
export const REVEAL_GOLD_PER_CIRCLE = 25; // discovery bonus scales with the player's laps around the board
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
// While even the furthest-along player hasn't finished this many laps yet,
// the game is still a "getting started" phase -- the long path's hidden
// coin flip (rollAndMove.ts) is forced short rather than risk stranding a
// brand-new player on the longer route, and Joker's Queen's Gift (joker.ts)
// falls back to gold instead of a Camp/Tower for the same reason. Reused
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
// Every owned tile also brings in a flat militia trickle every turn, on top
// of whatever its own bonus produces (gold-type tiles) or in addition to it
// (units-type tiles) -- see game/income.ts's tileTurnIncome.
export const FLAT_TILE_UNIT_INCOME = 1;

export const UNIT_PRICE = 50; // gold per militia unit (King's Castle recruit price)
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
export const BRAWL_THRESHOLD = 10; // defence at or below this triggers brawl mode (manual duel-by-duel rounds)
export const BANZAI_THRESHOLD = 0.9; // risky banzai mode triggers when the attacker's army power is below this fraction of the tile's defence

// Army composition (Riders): a second, pricier unit tier unlocked at KNIGHT_FAME.
export const RIDER_UNIT_PRICE = 100; // gold per rider
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
export const ARMY_SLOT_CAPACITY = 12; // max units of one tier per slot
// A tile garrison's own per-slot cap -- independent of ARMY_SLOT_CAPACITY
// (see overridesStore.ts's armySlotCapacity/garrisonSlotCapacity split).
export const GARRISON_SLOT_CAPACITY = 8;
// Every tile holds this many garrison slots beyond its level, so capacity
// runs 16/24/32 by level rather than 8/16/24 (see Tile.ts's garrisonSlots).
export const GARRISON_BONUS_SLOTS = 1;
// Multiplies a Tower's fortification roll bonus (getGarrisonBonusPct), the
// lever for making Towers defend better than everything else now that
// capacity no longer distinguishes them. 1 = no advantage.
export const TOWER_FORTIFICATION_MULT = 1;
export const MAX_ARMY_SLOTS = 5;
// Fame thresholds for army slots: 0-2 fame -> 2 slots, 3-5 -> 3, 6-9 -> 4, 10+ -> 5.
// Uneven bracket widths, so this is a lookup table, not a uniform step size.
export const ARMY_SLOT_FAME_THRESHOLDS: { minFame: number; slots: number }[] = [
  { minFame: 10, slots: MAX_ARMY_SLOTS },
  { minFame: 6, slots: 3 },
  { minFame: 3, slots: 2 },
  { minFame: 0, slots: 1 },
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
// Width is the tighter of the two: at 10 columns two evenly-matched
// single-tier armies whose squads happen to pack widest (9v9, 19v19, 29v29
// -- 20 of 3364 real size/tier combos) overlap by 2-3 units at the center
// gap, which extra rows don't help since it's a horizontal squeeze. Kept at
// 10 deliberately for the tighter board; 11 is the collision-free width.
export const SMALL_AUTO_BATTLE_THRESHOLD = 30;
export const SMALL_BATTLEFIELD_COLS = 10;
export const SMALL_BATTLEFIELD_ROWS = 15;
// Above this on EITHER side, the board gets taller and a little narrower --
// the extra height keeps a big grouped formation (towers/squads, see
// formations.ts's layoutGroup) from overlapping at the standard
// BATTLEFIELD_ROWS, and the tighter width closes the approach. Sized for up
// to AUTO_BATTLE_LARGE_THRESHOLD a side: the worst real split there (as
// lopsided as a Knight's army gets, e.g. 1 militia + 39 riders) measures 16
// rows, so 20 leaves a real margin without the excess scroll a flat 27 would
// cost a fight barely over SMALL_AUTO_BATTLE_THRESHOLD.
export const HUGE_BATTLEFIELD_COLS = BATTLEFIELD_COLS - 2;
export const HUGE_BATTLEFIELD_ROWS = BATTLEFIELD_ROWS + 4;
// Above AUTO_BATTLE_LARGE_THRESHOLD a side -- a maxed-out army (5 slots x
// ARMY_SLOT_CAPACITY each) tops out around 23 rows in its worst (most
// lopsided) split, so 27 keeps the same margin HUGE_BATTLEFIELD_ROWS does at
// its own ceiling.
export const MASSIVE_BATTLEFIELD_COLS = BATTLEFIELD_COLS - 2;
export const MASSIVE_BATTLEFIELD_ROWS = BATTLEFIELD_ROWS + 11;
// The dragon fight is an encirclement, not a face-off: both sides share the
// middle of the board (see formations.ts's encircle/huddle), so it needs a
// roughly SQUARE board rather than a tall corridor -- the ring is only as
// round as the largest circle the board can hold. Rows step down by
// sqrt(3)/2 of the column pitch, so ~1.15 rows per column comes out square
// on screen. Sized to seat the ring, the huddle and a gap between them:
// 48 dragons + up to 60 militia/riders inside an inscribed circle of ~170
// cells.
export const DRAGON_BATTLEFIELD_COLS = 15;
export const DRAGON_BATTLEFIELD_ROWS = 19;
// Landing on an abandoned (zombie-guarded) tile has this chance to trigger a
// zombie ambush — same mechanics as a regular Ambush, but the attackers are
// zombies drawn from the tile's own garrison (see zombieAmbushEncounter.ts).
export const ZOMBIE_AMBUSH_CHANCE = 0.3;
export const ZOMBIE_AMBUSH_FORCE_RATIO = 2 / 3;
// Brawl (small skirmish): a compact board with larger cells, used for the
// turn-based / manually-controlled brawl fights instead of the full-size
// battlefield above. A battle is a brawl when both sides field at most
// BRAWL_THRESHOLD grid units.
// 7, not 6: the extra column of approach room measurably evens out the
// small-fight win rates (the two blocks otherwise start almost in contact,
// letting the starting geometry decide the whole fight).
export const BRAWL_COLS = 7;
export const BRAWL_ROWS = 7;
export const MILITIA_HP = 6;
export const MILITIA_DMG_MIN = 4;
export const MILITIA_DMG_MAX = 16;
export const RIDER_HP = 12;
export const RIDER_DMG_MIN = 8;
export const RIDER_DMG_MAX = 18;
// The dragon fights as its own kind, not a rider — see the 'dragon'
// formation in game/battleGrid/formations.ts, always exactly DRAGON_UNITS.
export const DRAGON_HP = 25;
export const DRAGON_DMG_MIN = 2;
export const DRAGON_DMG_MAX = 20;
// Per-side cap on how many real militia/riders get their own grid unit —
// above this, army composition is proportionally downscaled to fit the
// 16x20=320-cell battlefield (see game/battleGrid/scale.ts).
export const MAX_GRID_ARMY_SIZE = 150;

// Abandoned tiles (razed, never reclaimed) are guarded by Zombies instead of
// regular militia — their own stats, not a multiple of militia's (the damage
// range needed a different factor at each end, so multipliers couldn't express it).
export const ZOMBIE_HP = 10;
export const ZOMBIE_DMG_MIN = 6;
export const ZOMBIE_DMG_MAX = 18;
