Using Reacts.js and TypeScript. All the necessary data is stored in Local Storage.

This project is a board game simulator, players make moves in turns according to the dice roll (random int 1 to 6). Players move along the path that is a close circuit of slots (20-40 of them), each having own coordinates on the map and occupied by some tile. Tiles are defined in settings/tiles.json, coordinates in settings/map.json and map_mobile.json.

Separate classes exist for Tile, Player, Dice and Board.

## Game setup and components:

Tile and Player initial setup are loaded from separate JSON files in /settings.

### Board:

Board has these properties: tile sequence, player positions, active player, player order.

### Players:

Players are represented by colored circle and text name below. Player order is determined randomly at the game start. Players have these properties: name, color, account with amount of gold and amount of units (always 0 or positive), owned tiles, position (tile number).

### Tiles have these properties:

Group, name, is ownable, price to own in gold (0) and price to own in units (can be 0), Upgrade level 1,2 or 3 (initial is 1), price to upgrade to these levels (in gold and units) and bonus/fee (in gold) and defence (in units) on each level.

Examples:

- Group: Mills, Name:Water mill, Price: 200 GP and 5 U, price to upgrade to level 2: 300 GP and 5 U, price to upgrade to level 3: 500 GP and 10 U, bonus/fee on level 1: 100 GP, bonus/fee on level 2: 200 GP, bonus/fee on level 3: 300 GP, defence on level 1: 10 U, defence on level 2: 15 U, defence on level 3: 30 U, not owned by anyone, Current level: 1

- Group: Farms, Name: Pig farm, Price: 150 GP and 5 U, price to upgrade to level 2: 200 GP and 1 U, price to upgrade to level 3: 300 GP and 3 U, bonus/fee on level 1: 50 GP, bonus/fee on level 2: 100 GP, bonus/fee on level 3: 200 GP, defence on level 1: 5 U, defence on level 2: 10 U, defence on level 3: 15 U, owned by player 2, Current level: 2

### Player Stats table

Player data is constantly displayed under the board: a table, row for each player, columns: name, gold, units, owned tiles (comma-separated tile names followed by it's level in brackets)

### Dice

Dice is displayed to visually reproduce random number generation each time when it's needed.

### Game menu

Game menu displays different buttons according to the current game situation and provides player with some choice selection, each button triggering some action.

## Player moves:

Players play in turns.

If move options is selected, the dice is rolled - random interer number is being generating from 1 to 6 and Player moves along the path forward by this generated amount of tiles. When player finish the move, they land on according tile. Tile could be owned or be not ownable and trigger some attached action.

When any player pass the first tile, he receives 500 gold and 5 units.

When player gets to an ownable tile not owned by anyone and he has money and units more or equal to the tile's price, he should be presented with menu with 2 options: to buy it (make it own) by paying the stated prices or to just pass over. If the player deicdes to buy, the amounts are distracted from his resources and the title is set to be owned by this player.

When player gets to an ownable tile already owned by someone else, the check is being performed: if player has more units than this tile defence on it's current level, he could will be be presented with menu with two options: to pay the fees or to fight, otherwise only with one option to pay.

If option to pay fees is chosen, the amount in gold is distracted from players account according to the title parameters. If option to fight is chosen, the defence amount is distracted from player's account, the tile level is set to 1 and tile is set to be not owned. After that if that player has enough money to own this tile, he could pay for it and own it.

If player chooses an option to upgrade own tile, he should be present with menu of list of his own tiles for which he has enough resources to spend to upgrade to the next level. Menu should also contain 'Cancel' Button returning him to prevoius menu (roll dice/upgrade) If he chooses to upgrade the tile, corresponding amounts of gold and units are distracted from his account.
