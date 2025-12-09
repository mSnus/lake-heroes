I've analyzed the core game logic files. Here's a summary of the game flow:

The game is managed by the `GameState` class, which tracks players, tiles, and the current turn. The game progresses in phases: `before-move`, `rolling`, `moving`, and `after-move`.

1.  **Initialization**: The game starts with a set of tiles organized in a circular path and players. The game board is set up with a sequence of tiles, the number of which is defined in `common.ts` (TILE_COUNT). Tile properties are defined in `tiles.json`, and player setup is in `players.json`.

2.  **Game Resources**: Each player has gold and units. Players can gain resources in several ways:
    *   **Income**: By passing the "King's Castle" tile or landing on a tile they own.
    *   **Special Tiles**: From special tiles like the "Sphinx" and "Treasury."
    Players can lose resources by landing on another player's tile or from certain special tiles.

3.  **Game Start**: Players begin at tile 0, the "King's Castle." The turn order is determined randomly.

4.  **Turn Start**: The active player's turn begins in the `before-move` phase.

5.  **Rolling**: The player rolls dice to determine how many spaces to move. Dice are also used for random events on certain tiles (e.g., "Sphinx").

6.  **Moving**: The player's piece advances along the circular path of tiles according to the dice roll. If a player passes the "King's Castle" (tile 0), they receive income. The tile the player lands on determines the next action.

7.  **Ownable Tile Interaction**:
    *   **Unowned Tile**: The player can purchase the tile if they have enough resources.
    *   **Opponent's Tile**: The player may have to pay a fee or can choose to initiate a battle to take over the tile.
    *   **Own Tile**: The player receives a bonus from the tile and may have the option to upgrade or sell it.
    *   **Inability to Pay**: If a player cannot afford a fee, they must sell their own tiles to raise the funds. If they still cannot pay, they are eliminated from the game.

8.  **Battle**: A battle is an attempt to take ownership of a tile from another player.
    *   The attacking player must have at least as many units as the tile's defense value.
    *   The attacker rolls a die. A roll of 4 or higher results in a win.
    *   **Victory**: The attacker loses units equal to the tile's defense but takes control of the tile. The tile's level is reset to 1, and it becomes unowned, giving the attacker the option to buy it.
    *   **Defeat**: A roll of less than 4 means the battle is lost. The attacker loses units equal to the tile's defense, and the turn ends.

9.  **Death and Winning**: If only one player remains, they are the winner.

10. **Turn End**: The turn concludes in the `after-move` phase, and the next player in the order takes their turn.

This cycle repeats until a single player remains or a predetermined number of turns is completed.