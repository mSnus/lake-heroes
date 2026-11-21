# Karma

Karma is a hidden moral score for each player. It starts at 0, always stays between **−5 and +5** (`KARMA_MIN`, `KARMA_MAX`), changes silently with no toast or log line, and only shows as an icon next to the player's name.

| Karma | Icon | State |
|---|---|---|
| −5 to −3 | 🕷️ | **cursed**: hostile odds go up |
| −2 to −1 | 🕷️ | no effect yet (warning sign) |
| 0 | (hidden) | neutral |
| 1–2 | 🕊️ | no effect yet |
| 3 to 5 | 🌈 | **blessed**: luck improves |

Tapping the icon in the stats panel shows a short toast: "Let's see where bad karma leads you" or "Good karma brings good luck".

The thresholds are `KARMA_CURSED` (−3) and `KARMA_BLESSED` (3), checked by `isCursed` and `isBlessed` in `src/utils/karma.ts`.

## How karma changes

**Loses 1 karma**
- Looting a tile (`actions/lootTile.ts`)
- Razing a tile after winning a revenge battle against its owner (`actions/battles/resolveTileBattle.ts`)
- Attacking another player at Hero Hour, whether or not the attack succeeds (`HeroHourScreen.tsx`, `afterMoveLogic.ts`)

**Gains 1 karma**
- Going in peace after paying a toll, up to a maximum of 3 karma (`TollScreen.tsx`)
- Beating the zombies that guard an abandoned tile (`battleGrid/battleResolution.ts`)
- Freeing a caravan that carries only slaves (`actions/battles/resolveCaravanBattle.ts`)

Raiding a caravan for gold or horses does not change karma.

**Yearly drift:** at every Harvest, karma moves 1 step back toward 0 (`game/year.ts`).

**Prison resets it:** landing on Prison, or being taken there as a prisoner of war, sets karma back to 0 (`resetKarma`).

**Loot ban:** reaching −5 bars the player from looting until their karma is back at 0 or above (`Player.lootBanned`, checked by `canLoot`). Prison lifts the ban too.

Every change is clamped to the −5…+5 range (`changeKarma` in `src/utils/karma.ts`), so an old save with lower karma snaps to −5 on its next change.

## Effects

| Effect | Normal | Cursed (≤ −3) | Blessed (≥ 3) |
|---|---|---|---|
| Joker draws a bad event | 50% | 80% | 15% |
| Bandit ambush chance | 1/14 | ×2.25 | ×0.85 |
| Roaming horde (rogue) attack chance | 1/28 | ×2 | ×0.85 |
| Dragon encounter chance | 1/12 | ×2 | — |
| Dragon attacks (rather than flying over) | 1/3, or 1/2 above fame 5 | ×2.25, capped at certain | ×0.85 |
| Zombie ambush on an abandoned tile (landing or looting) | 30% | ×2 | — |
| Caravan encounter chance (gold, slaves or horses) | 1/6 | — | ×1.25 |
| Spared when hit by a Joker's Plague, Earthquake, Meteor or Hurricane | — | — | 50% |
| Die quietly loaded to land on Prison, when Prison is on the picked road | — | 5% | — |
| Portal drops the player in Prison instead of a random tile | — | 5% | — |

The constants live in `src/game/constants.ts`:

| Constant | Value |
|---|---|
| `KARMA_JOKER_BAD_CHANCE` | 0.8 |
| `KARMA_HOSTILE_ENCOUNTER_MULTIPLIER` | 2.25 |
| `KARMA_CURSED_ENCOUNTER_MULTIPLIER` | 2 |
| `KARMA_PRISON_CHANCE` | 0.05 |
| `KARMA_BLESSED_JOKER_BAD_CHANCE` | 0.15 |
| `KARMA_BLESSED_HOSTILE_MULTIPLIER` | 0.85 |
| `KARMA_BLESSED_CARAVAN_MULTIPLIER` | 1.25 |
| `KARMA_BLESSED_EVENT_DODGE` | 0.5 |
| `ZOMBIE_AMBUSH_CHANCE` | 0.3 |

## Bots and karma

Bots weigh karma before the two acts that cost it, looting and revenge (which razes the tile on a win). After their usual checks pass, they go through with it only with this chance (`karmaWillingness`):

| Karma | 0 and up | −1 | −2 | −3 | −4 | −5 |
|---|---|---|---|---|---|---|
| Chance to loot or take revenge | 100% | 80% | 60% | 40% | 20% | never |

On top of that, a bot loots only when the expected haul at a normal roll (the tile's turn income plus a quarter of its price in gold, see `lootPrize`) is worth:
- more than a year of the bot's own income of gold and that resource, and
- at least as much as the gold and that resource it already holds.

Everything is counted in gold: food and arms at the Harvest sell price, units at a militia's recipe. See `shouldLootTile` and `shouldSeekRevenge` in `src/ai/decisions.ts`.

Hero Hour attacks also cost karma, but bots don't weigh karma for them yet.
