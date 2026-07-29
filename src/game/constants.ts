export const MONEY_START = 150;
export const UNITS_START = 20;
export const MONEY_PASS_START = 500;
export const MONEY_PASS_START_FAME = 200;
export const FEE_MULTIPLIER = 50;
export const TREASURE_BOX_MULTIPLIER = 200;
export const TILE_COUNT = 25;
export const MAX_PLAYERS = 6;
export const REVEAL_GOLD_PER_CIRCLE = 100; // discovery bonus scales with the player's laps around the board

export const UNIT_PRICE = 100; // gold per militia unit (King's Castle recruit price)
export const DRAGON_UNITS = 50; // units on each side of the dragon battle
export const DRAGON_GOLD = 100000; // dragon's hoard, awarded on victory
export const KNIGHT_FAME = 4; // fame at or above this makes a player a knight (rider sprite) and unlocks Rider recruiting
export const BRAWL_THRESHOLD = 6; // defence at or below this triggers brawl mode (manual duel-by-duel rounds)

// Army composition (Riders): a second, pricier unit tier unlocked at KNIGHT_FAME.
export const RIDER_UNIT_PRICE = 300; // gold per rider
export const MILITIA_POWER_WEIGHT = 1;
export const RIDER_POWER_WEIGHT = 2.5;
export const ARMY_SLOT_CAPACITY = 10; // max units of one tier per slot
export const MAX_ARMY_SLOTS = 5;
export const ARMY_SLOT_FAME_STEP = 3; // +1 slot per this many fame, up to MAX_ARMY_SLOTS

export const SPRITE_SIZE = 96;
