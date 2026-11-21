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
| Fields | 15–35🟡 | 30–35🟡 | 60🟡 |
| Farms | 20–40🟡 | 30–40🟡 | 60–80🟡 |
| Traders | 25–45🟡 | 30–45🟡 | 60🟡 |
| Mills, Mines | 30–40🟡 | 60–85🟡 | 110–150🟡 |
| Camps, Crafts | 40–60🟡 | 75🟡 | 150🟡 |
| Towers | 60–100🟡 | 75–100🟡 | 150🟡 |

For example, the Wheat Field charges 15 / 30 / 60🟡 and the Gold mine 40 / 85 / 150🟡. Prices, and so tolls, are multiples of 5 (`roundGold`).

Prices come from each tile's coefficients in `src/settings/tiles.json`, times a base of 10🟡 for level 1 and 20🟡 for upgrades (`TILE_BASE_PRICE`, `TILE_BASE_UPGRADE`).

## What changes it

- **Pipe of Hamelin** (artifact): the payer pays half again, so a quarter of the price (`getFeeMultiplier` in `src/game/artifacts.ts`).
- **Owner in prison:** no toll. Other players can raze the tile from its Tile Card instead (`src/actions/razeJailedTile.ts`).
- **Yielded tile:** no toll; the visit is free.

Syndicates, garrison size, tile income, the year and the 5× gold income don't affect it.

## Paying it

The toll is charged automatically on landing (`chargeToll` in `src/actions/afterMoveLogic.ts`):

1. The player pays as much as they can.
2. If gold runs short, they can sell their own tiles, or yield them to the King for half their price, to cover the rest.
3. If it still can't be covered, they become the owner's **prisoner of war**. The owner earns a ⭐ star, the only way to earn one; 3 stars win the game.

Once the toll is settled the player chooses:
- **Go in peace:** +1 karma, up to a maximum of 3.
- **Revenge:** fight the tile's garrison. A win razes the tile and pays half its price in gold; it costs the attacker 1 karma and the owner 1 fame, and gives the attacker no fame.

## Bots

- **Shortfall:** when yielding tiles would raise enough, a bot yields its least valuable ones until the toll is covered (`pickTilesToYield` in `src/ai/decisions.ts`). Otherwise it sells them one at a time (`sortTilesBySacrifice`), and accepts prison only when nothing is left to sell.
- **Buying back:** at the start of each turn a bot takes yielded tiles back, best income first, while its gold stays above its tile reserve (`pickTilesToTakeBack` in `src/ai/botPlans.ts`).
- **Revenge:** a bot takes revenge when its army power is at least 2× the garrison (Explorer), 1.5× and over 20 (Warrior), or 2.2× and over 20 (Wizard). The lower its karma, the less likely it goes through with it: 80% at −1 down to never at −5 (`shouldSeekRevenge`).
- **No planning ahead:** bots keep a gold reserve for tiles, not for tolls; yielding is what covers a shortfall. With it, toll sales dropped to under a fifth of tile losses in the simulator, and players being taken prisoner (the only source of stars) became rare.

## Scale

Tolls are cheap compared with income. A level-1 Gold mine pays its owner 75🟡 at every Harvest, while landing on a level-3 Tower costs 150🟡. They bite when a player's gold is tied up in units and garrisons as the toll comes due.
