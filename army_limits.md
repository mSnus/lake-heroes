# Army limits

A player's field army is capped by their fame 🏆, with a separate cap for each tier: 🧍 militia and 🐎 riders (`MILITIA_CAP_BY_FAME` and `RIDER_CAP_BY_FAME` in `src/game/constants.ts`, read by `armyCapacityForFame` in `src/game/army.ts`).

The two caps are independent: riders never take militia room, and the other way round.

## Militia cap

| Fame 🏆 | Max 🧍 militia |
|---|---|
| 0–2 | 12 |
| 3–5 | 16 |
| 6–9 | 20 |
| 10–12 | 32 |
| 13–15 | 40 |
| 16+ | 60 |

## Rider cap

Riders need knighthood. A player becomes a Knight on their next pass over the King's Castle once their fame is 7 or more (`KNIGHT_FAME`, `src/actions/knightPromotion.ts`). Until then their rider cap is 0. A new Knight gets the bottom row straight away.

| Fame 🏆 | Max 🐎 riders (Knights only) |
|---|---|
| up to 10 | 8 |
| 11–12 | 12 |
| 13–15 | 16 |
| 16–17 | 24 |
| 18–19 | 32 |
| 20+ | 40 |

## Total army by fame

| Fame 🏆 | Not a Knight | Knight |
|---|---|---|
| 0–2 | 12 | — |
| 3–5 | 16 | — |
| 6 | 20 | — |
| 7–9 | 20 | 20 + 8 = 28 |
| 10 | 32 | 32 + 8 = 40 |
| 11–12 | 32 | 32 + 12 = 44 |
| 13–15 | 40 | 40 + 16 = 56 |
| 16–17 | 60 | 60 + 24 = 84 |
| 18–19 | 60 | 60 + 32 = 92 |
| 20+ | 60 | 60 + 40 = 100 |

Fame never drops below 1 (`changeFame` in `src/utils/fame.ts`), so a player's caps never fall under the 12-militia row.

## What the caps limit

The caps limit **growth**: every way of gaining units stops at the cap (`Player.armyRoom`, `gainMilitia` and `gainRiders` in `src/game/Player.ts`).
- **Hiring** at the King's Castle, Tavern, Stables and Workers.
- **Tile income** from Towers. The per-turn units are cut to the militia room left (`playerTurnIncome` in `src/game/income.ts`).
- **The King's Grace.**
- **Mounting militia as riders,** and mounting captured caravan horses or Tavern horses: only as many as the rider room allows.
- **Dismounting riders** back to militia: only as many as the militia room allows.

What doesn't fit is simply lost; nothing is queued for later.

**A fame drop never takes units away.** An army above its new cap keeps every unit; it just can't grow until it is back under the cap.

Units can also end up above the cap without any fame drop. These don't check the cap:
- **Taking units back from a garrison** to the field army.
- **Selling a tile:** its garrison rejoins the army in full.

## Where it shows

- **The player panel** shows the field army against its caps, e.g. `12 / 16`; riders appear once the player is a Knight (or holds any).
- **"Max capacity for N🏆 reached"** appears under it when Tower income has more units to give but the militia cap is full.
- **"Gain more fame 🏆 for a bigger army"** appears at fame 1 with no unit income.

## Garrisons

Tile garrisons are a separate limit and don't depend on fame. A tile holds 8 units per garrison slot (`GARRISON_SLOT_CAPACITY`), and has its level + 1 slots (`GARRISON_BONUS_SLOTS`). That gives 16 / 24 / 32 units at levels 1 / 2 / 3. Garrisoned units don't count against the field army's caps, so garrisoning frees room to hire more.
