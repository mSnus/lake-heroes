# Hero's Hour

When a player ends their move on a tile where another player's army stands, they can challenge them to a duel (`src/actions/afterMoveLogic.ts`, `src/components/screens/HeroHourScreen.tsx`).

## When it happens

All of these must hold:
- The game is in its 5th year or later.
- The tile is an ownable tile: not the King's Castle and not a special tile.
- The moving player has at least one unit.
- At least one other player on the tile has at least one unit.

With several players on the tile, the mover picks whom to challenge.

## The choice

- **⚔️ Fight:** costs the challenger −1 karma straight away, win or lose.
- **Greet and pass:** no fight.
  - If the tile belongs to another player, this leads on to the normal toll encounter.
  - Otherwise the turn simply goes on.

## The battle

- **Armies:** both players fight with their whole field army on the usual battlefield (`resolvePlayerBattle.ts`). Garrisons don't take part.
- **Losses:** both sides lose the units killed in the fight, as in any other battle. The result message reports both sides' losses.

| Result | Winner | Loser |
|---|---|---|
| **Win** | +1 🏆 fame | −1 🏆 fame, and thrown into **Prison** |

**Prison** has its usual effects (`imprison` in `src/actions/prison.ts`):
- Karma reset to 0, which also lifts a loot ban.
- One skipped turn, unless a Medal of Honor or Medal of Distinction spares it.
- The usual fine when leaving.
- While inside, nobody collects tolls on their tiles, and other players can raze them.

**A draw** is rare, since battles are set up not to tie. Both sides then lose a quarter of the smaller army's size, and nobody goes to Prison.

Gold, tiles and garrisons are never taken in a Hero's Hour fight.

## Bots

A bot fights the weakest opponent on the tile whose army power it beats by its personality's margin (`pickHeroHourTarget` in `src/ai/decisions.ts`):

| Personality | Fights when its army power is at least |
|---|---|
| Warrior | 1.5× the opponent's |
| Wizard | 1.7× the opponent's |
| Explorer | 2× the opponent's |

Otherwise it greets and passes. Unlike looting and revenge, its karma doesn't hold it back here.

## Things to know

- **A fight skips the toll.** After a duel the turn ends. If the tile belongs to another player, the challenger never pays its toll; only "greet and pass" leads on to the toll encounter.
- **The defender can lose a turn without choosing to fight:** a beaten defender goes to Prison just like a beaten challenger.
- **The King's Castle is neutral ground,** so no duels happen there.
