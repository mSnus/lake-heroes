# Events

Everything that can happen to a player beyond their own choices: Joker events, random encounters and the yearly calendar. Karma modifiers are summarised in `karma.md`, caravans in more detail in `caravan.md`.

## Joker 🃏

The Joker strikes in two ways (`src/actions/joker.ts`):
- **Landing on the Joker tile.**
- **At random before a move:** 5% per turn, but only once every player at the table has fame 5 or more (`src/actions/jokerEncounter.ts`).

It first decides between a bad and a good event, then picks one at random within that half:

| Lander's karma | Bad event | Good event |
|---|---|---|
| Normal | 50% | 50% |
| Cursed (≤ −3) | 80% | 20% |
| Blessed (≥ 3) | 15% | 85% |

### Bad events

| Event | Effect | Protection |
|---|---|---|
| 🧾 **Unjust Taxes** | No tile income for anyone for the rest of the year, this year's Harvest included. The King's Grace is still paid, minus its per-tile part. | — |
| 🦠 **Plague** | Every owned, non-yielded tile's garrison loses half its defenders (each tier on its own, never below 1). Field armies are untouched. | Pipe of Hamelin; Divine Beads 50% |
| 🌪️ **Hurricane** | Only if the strongest player is at least 1.5× the second: their most expensive tile becomes unowned (level 1) and they lose 1 fame. Otherwise nothing happens. | Divine Beads 50% |
| 🪨 **Earthquake** | Every player except the weakest: upgraded tiles lose a level; a player with no upgraded tiles loses their cheapest tile and 1 fame. | Divine Beads 50% |
| ☄️ **Meteor** | A random tile of the strongest player (never the weakest) becomes unowned (level 1); they lose 1 fame. | Indestructible Umbrella; Divine Beads 50% |
| 🟫 **Rust** | Every player's arms drop to 0. Only drawn while someone holds arms. | — |
| 🦗 **Locust** | Every player's food drops to 0. Only drawn while someone holds food. | — |

### Good events

| Event | Effect |
|---|---|
| ✨ **Blessing** | Every owned, non-yielded tile below level 3 gains a level. |
| 💍 **Queen's Gift** | The player who drew it gets a free unowned Camp or Tower and +1 fame. In the first 3 years, or with none free, 300🟡 and 5🧍 instead. |
| 👑 **King's Gift** | The player who drew it gets a random artifact nobody owns yet, or 200🟡 if none are left. |

The result is announced in a toast and stays on the banner until another message replaces it or the turn comes back to the player who drew it.

## Random encounters

### Before the move

Checked in this order, at most one per turn (`src/actions/rollAndMove.ts`).

**🐉 Dragon** (`src/actions/dragonEncounter.ts`)
- **When:** from year 5, at most once a year, never two turns in a row. 1/12 per turn, ×2 when cursed.
- **Flies over harmlessly** below fame 4, in years 1–3, or when the attack roll fails.
- **Attack chance:** 1/3 (1/2 above fame 5); cursed ×2.25 (up to certain), blessed ×0.85.
- **Army power under 120:**
  - It skips players who own no tiles.
  - It spares the weakest player while the strongest is far ahead.
  - Otherwise it burns the player's most expensive tile: a level-1 tile is razed, a higher one loses a level and half its garrison.
  - Protection: Indestructible Umbrella; Divine Beads 50%.
- **Army power of 120 or more:** the player may fight the dragon (a win ends the game) or flee.

**🏴 Rogue raid** (`src/actions/rogueAttackEncounter.ts`)
- **When:** from year 3, fame 3 or more, owning a non-yielded tile; at most once a year. 1/28 per turn; cursed ×2, blessed ×0.85.
- **Effect:** a horde of 30–120% of one random tile's garrison attacks it.
  - Empty garrison or a lost fight: the tile is razed and the owner loses 1 fame.
  - Won fight: the garrison keeps the tile but loses the units killed.

**🧑‍🌾 Free Folk / Traveling Traders** (`src/actions/workersEncounter.tsx`)
- **When:** from year 3, at most once a year. 1/12 per turn, doubled for a player who has had no units for over a year.
- **Either Traveling Traders (50%):** a market where one resource is in demand. The traders sell it at half the Harvest price and buy it at double; their exchange is 1:1.
- **Or Free Folk (50%):** hire units at Tavern prices (60🟡 a militia, 120🟡 a rider), gold only, no food or arms.

**🃏 Joker:** 5% per turn once everyone has fame 5 (see above).

### On landing

**🐫 Caravan:** only on empty road. 1/6 per eligible landing, at most once a year. A raid for its gold, slaves or horses. Full rules in `caravan.md`.

**🗡️ Bandit ambush** (`src/actions/ambushEncounter.tsx`)
- **When:** only on empty road, if no caravan came. From year 3, fame 8 or more, army power over 15, at most once a year. 1/14 per turn; cursed ×2.25, blessed ×0.85.
- **Effect:** bandits of 50–70% of the player's army, tier by tier, attack. Each bandit beaten pays 20🟡.

**🧟 Zombie ambush** (`src/actions/zombieAmbushEncounter.tsx`)
- **When:** landing on, or looting, an abandoned (razed) tile whose zombies the player's army can actually face. 30%, cursed ×2.
- **Effect:** the tile's zombies attack.
  - Repelled: the tile's wild garrison is halved (it regrows from there) and the player gains +1 karma.
  - The tile itself is never taken by the ambush.

**⚔️ Hero Hour** (`src/actions/afterMoveLogic.ts`)
- **When:** from year 5, landing on a tile (not the King's Castle) where another player with units stands.
- **Choice:** fight one of them (−1 karma, win or lose) or greet them and pass.
- **Result:** the loser is sent back to the King's Castle, and the winner gains 1 fame while the loser loses 1.

## The year

A year is 4 rounds (`TURNS_PER_YEAR`). When it ends (`src/game/year.ts`):

1. **Harvest:** every tile pays its owner its income (gold, food, arms or units), unless Unjust Taxes is in force. Each player then gets a Harvest turn to buy, sell and exchange food and arms.
2. **Karma** moves 1 step back toward 0.
3. **Lucky groups:** each of Mills, Farms, Fields, Mines and Crafts has a 25% chance of double income for the new year (at most 2 groups).
4. **Yearly limits reset:** dragon, caravan, ambush, raid and Free Folk encounters.

## Passing the King's Castle

Crossing or landing on the King's Castle starts a new lap and pays the **King's Grace**: gold and units, more for weaker players, plus a small part from each tile owned (`src/game/kingsGrace.ts`). Unjust Taxes withholds only the per-tile part.

The first lap completed is worth +1 fame. Landing exactly on the Castle also opens hiring and may offer a King's Contract.
