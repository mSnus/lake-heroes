# Toll

Landing on a tile another player owns costs a toll, paid straight to the owner.

## How it's calculated

A toll is half the tile's price at its current level, rounded (`Tile.fee` in `src/game/Tile.ts`):

```ts
get fee() {
  return Math.round(Math.max(this.prices[this.level], this.prices[1]) * FEE_MULTIPLIER); // FEE_MULTIPLIER = 0.5
}
```

The "price at its current level" is:
- **Level 1:** the claim price.
- **Levels 2 and 3:** the cost of that upgrade alone, not the total paid so far.

The `max` with the claim price only matters where a level-2 upgrade costs less than the claim (Farms, Fields, Traders).

| Group | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| Fields (e.g. Wheat) | 30🟡 | 60🟡 | 120🟡 |
| Farms (e.g. Pigs) | 40🟡 | 60🟡 | 120🟡 |
| Traders (e.g. Grapes) | 50🟡 | 60🟡 | 120🟡 |
| Mills, Mines | 60🟡 | 120🟡 | 220🟡 |
| Camps, Technology | 80🟡 | 150🟡 | 300🟡 |
| Towers | 120🟡 | 150🟡 | 300🟡 |

Prices come from each tile's coefficients in `src/settings/tiles.json`, times a base of 20🟡 for level 1 and 40🟡 for upgrades (`TILE_BASE_PRICE`, `TILE_BASE_UPGRADE`).

## What changes it

- **Pipe of Hamelin** (artifact): the payer pays half again, so a quarter of the price (`getFeeMultiplier` in `src/game/artifacts.ts`).
- **Owner in prison:** no toll. Other players can raze the tile from its Tile Card instead (`src/actions/razeJailedTile.ts`).
- **Yielded tile:** no toll; the visit is free.

Syndicates, garrison size, tile income, the year and the 5× gold income don't affect it.

## Paying it

The toll is charged automatically on landing (`chargeToll` in `src/actions/afterMoveLogic.ts`):

1. The player pays as much as they can.
2. If gold runs short, they can sell their own tiles to cover the rest.
3. If it still can't be covered, they become the owner's **prisoner of war**. The owner earns a ⭐ star, the only way to earn one; 3 stars win the game.

Once the toll is settled the player chooses:
- **Go in peace:** +1 karma, up to a maximum of 3.
- **Revenge:** fight the tile's garrison. A win razes the tile and pays half its price in gold, costs −1 karma and −1 fame for the owner, and gives no fame to the attacker.

## Bots

- **Shortfall:** bots sell their least valuable tiles one at a time until the toll is covered (`sortTilesBySacrifice` in `src/ai/decisions.ts`), and accept prison only when nothing is left to sell.
- **Revenge:** a bot takes revenge when its army power is at least 2× the garrison (Explorer), 1.5× and over 20 (Warrior), or 2.2× and over 20 (Wizard). The lower its karma, the less likely it goes through with it: 80% at −1 down to never at −5 (`shouldSeekRevenge`).
- **No planning ahead:** bots keep a gold reserve for buying tiles, not for tolls. In the simulator, selling tiles to cover tolls is the biggest single cause of bots losing tiles, about a third of all losses.

## Scale

Tolls are cheap compared with income. A level-1 Gold mine pays its owner 75🟡 a turn, while landing on a level-3 Tower costs 300🟡. They bite because bots usually have their gold tied up in units and garrisons when a toll comes due.
