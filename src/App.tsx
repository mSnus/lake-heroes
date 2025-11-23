import React, { useEffect, useState } from 'react';
import './App.css';
import { Tile } from './game/Tile';
import { Player } from './game/Player';
import { Board } from './game/Board';
import { BoardCanvas } from './components/BoardCanvas';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { Dice } from './game/Dice';
import { GameMenu } from './components/GameMenu';
import { PlayerStatsTable } from './components/PlayerStatsTable';

interface MenuState {
  type: 'main' | 'upgrade-list' | 'buy' | 'fee-or-fight' | 'wait' | 'move-result';
  tileIdx?: number;
  diceRoll?: number;
  passedStart?: boolean;
}

const BOARD_TILE_COUNT = 40;

function getRandomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    async function loadGameData() {
      const saved = loadFromStorage('board-state', null);
      if (saved) {
        setBoard(Object.assign(new Board([], []), saved));
        return;
      }
      const tilesResp = await fetch('/tiles.json');
      const tilesData = await tilesResp.json();
      const playersResp = await fetch('/players.json');
      const playersData = await playersResp.json();
      const tiles = Array.from({ length: 40 }, () => new Tile(getRandomOf(tilesData)));
      const players = playersData.map((p: any) => new Player(p));
      setBoard(new Board(tiles, players));
      setMenu({ type: 'main' });
    }
    loadGameData();
  }, []);

  useEffect(() => {
    if (board) saveToStorage('board-state', board);
  }, [board]);

  // Determine landing logic after moving
  function afterMoveLogic() {
    if (!board) return;
    const player = board.activePlayer;
    const tileIdx = player.position;
    const tile = board.tiles[tileIdx];
    // Not ownable or already owned by player
    if (!tile.isOwnable || tile.owner === player.name) {
      endTurn();
      return;
    }
    // Ownable, not owned, player can buy
    if (!tile.isOwned() && player.gold >= tile.priceGold && player.units >= tile.priceUnits) {
      setMenu({ type: 'buy', tileIdx });
      return;
    }
    // Ownable, owned by someone else
    if (tile.isOwned() && tile.owner !== player.name) {
      const tileLevel = tile.level;
      const fee = tile.bonuses[String(tileLevel)] || 0;
      const defence = tile.defences[String(tileLevel)] || 0;
      const canFight = player.units > defence;
      setMenu({ type: 'fee-or-fight', tileIdx });
      // Could further restrict options in fee-or-fight depending on canFight
      return;
    }
    // Else, just end turn
    endTurn();
  }

  function endTurn() {
    if (!board) return;
    board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    setMenu({ type: 'main' });
  }

  // Main dice-rolling action
  function onRollAndMove() {
    if (!board) return;
    const dice = new Dice();
    const roll = dice.roll();
    const player = board.activePlayer;
    const oldPos = player.position;
    const newPos = (oldPos + roll) % BOARD_TILE_COUNT;
    const passedStart = oldPos + roll >= BOARD_TILE_COUNT;
    player.position = newPos;
    if (passedStart) {
      player.gold += 500;
      player.units += 5;
    }
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    setMenu({ type: 'move-result', diceRoll: roll, passedStart });
  }

  function buyTile(
    menu: MenuState | null,
    board: Board | null,
    setBoard: any,
    endTurn: () => void
  ) {
    if (!board || !menu) return;
    const tile = board.tiles[menu.tileIdx!];
    const player = board.activePlayer;
    if (player.gold >= tile.priceGold && player.units >= tile.priceUnits && !tile.isOwned()) {
      player.gold -= tile.priceGold;
      player.units -= tile.priceUnits;
      tile.owner = player.name;
      player.ownedTiles.push(menu.tileIdx!);
      setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    }
    endTurn();
  }

  function payFee(menu: MenuState | null, board: Board | null, setBoard: any, endTurn: () => void) {
    if (!board || !menu) return;
    const tile = board.tiles[menu.tileIdx!];
    const player = board.activePlayer;
    const tileLevel = tile.level;
    const owner = board.players.find((p) => p.name === tile.owner);
    const fee = tile.bonuses[String(tileLevel)] || 0;
    if (player.gold >= fee && owner) {
      player.gold -= fee;
      owner.gold += fee;
      setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    }
    endTurn();
  }

  function fightTile(
    menu: MenuState | null,
    board: Board | null,
    setBoard: any,
    setMenu: any,
    endTurn: () => void
  ) {
    if (!board || !menu) return;
    const tile = board.tiles[menu.tileIdx!];
    const player = board.activePlayer;
    const tileLevel = tile.level;
    const defence = tile.defences[String(tileLevel)] || 0;
    if (player.units > defence) {
      player.units -= defence;
      tile.level = 1;
      tile.owner = undefined;
      // Remove from previous owner's ownedTiles
      board.players.forEach((p) => {
        p.ownedTiles = p.ownedTiles.filter((idx) => idx !== menu.tileIdx);
      });
      setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
      // If now affordable, offer to buy; else end turn
      if (player.gold >= tile.priceGold && player.units >= tile.priceUnits) {
        setMenu({ type: 'buy', tileIdx: menu.tileIdx });
        return;
      }
    }
    endTurn();
  }

  function upgradeTile(tileIdx: number, board: Board | null, setBoard: any, endTurn: () => void) {
    if (!board) return;
    const player = board.activePlayer;
    const tile = board.tiles[tileIdx];
    if (tile.owner !== player.name) return;
    const currentLvl = tile.level;
    if (currentLvl >= 3) return;
    const nextLvl = (currentLvl + 1) as 2 | 3;
    const price = tile.upgradePrices[String(nextLvl)];
    if (!price) return;
    if (player.gold >= price.gold && player.units >= price.units) {
      player.gold -= price.gold;
      player.units -= price.units;
      tile.level = nextLvl;
      setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    }
    endTurn();
  }

  // Replace renderMenu with GameMenu
  function renderGameMenu() {
    if (!board || !menu) return null;
    const activePlayer = board.activePlayer;
    if (menu.type === 'main') {
      return (
        <GameMenu
          title={`Player: ${activePlayer.name}`}
          items={[
            { label: 'Upgrade Owned Tile', onClick: () => setMenu({ type: 'upgrade-list' }) },
            { label: 'Roll Dice & Move', onClick: onRollAndMove },
          ]}
        >
          <div>
            Gold: {activePlayer.gold}, Units: {activePlayer.units}
          </div>
        </GameMenu>
      );
    }
    if (menu.type === 'upgrade-list') {
      const owned = activePlayer.ownedTiles.filter((idx) => {
        const tile = board.tiles[idx];
        const nextLvl = (tile.level + 1) as 2 | 3;
        const price = tile.upgradePrices[String(nextLvl)];
        return (
          tile.owner === activePlayer.name &&
          tile.level < 3 &&
          price &&
          activePlayer.gold >= price.gold &&
          activePlayer.units >= price.units
        );
      });
      return (
        <GameMenu
          title="Upgrade Tile"
          items={owned
            .map((idx) => {
              const tile = board.tiles[idx];
              const nextLvl = (tile.level + 1) as 2 | 3;
              const price = tile.upgradePrices[String(nextLvl)];
              return {
                label: `${tile.name} (Level ${tile.level}→${nextLvl}) — ${price.gold} GP, ${price.units} U`,
                onClick: () => upgradeTile(idx, board, setBoard, endTurn),
              };
            })
            .concat([{ label: 'Cancel', onClick: () => setMenu({ type: 'main' }) }])}
        >
          {owned.length === 0 && <div>No upgradeable tiles available</div>}
        </GameMenu>
      );
    }
    if (menu.type === 'move-result') {
      return (
        <GameMenu title="Move Result" items={[{ label: 'Continue', onClick: afterMoveLogic }]}>
          <div>
            {activePlayer.name} rolled <b>{menu.diceRoll}</b>!<br />
            Moved to tile <b>{activePlayer.position + 1}</b>
            {menu.passedStart && (
              <>
                <br />
                <span>Passed start: +500 GP, +5 U</span>
              </>
            )}
          </div>
        </GameMenu>
      );
    }
    if (menu.type === 'buy') {
      const tile = board.tiles[menu.tileIdx!];
      return (
        <GameMenu
          title="Buy Tile"
          items={[
            {
              label: `Buy ${tile.name} (${tile.priceGold} GP, ${tile.priceUnits} U)`,
              onClick: () => buyTile(menu, board, setBoard, endTurn),
            },
            { label: 'Pass', onClick: endTurn },
          ]}
        />
      );
    }
    if (menu.type === 'fee-or-fight') {
      const tile = board.tiles[menu.tileIdx!];
      const tileLevel = tile.level;
      const fee = tile.bonuses[String(tileLevel)] || 0;
      const defence = tile.defences[String(tileLevel)] || 0;
      const canFight = activePlayer.units > defence;
      let items = [
        { label: `Pay Fee (${fee} GP)`, onClick: () => payFee(menu, board, setBoard, endTurn) },
      ];
      if (canFight)
        items.push({
          label: `Fight (cost: ${defence} U)`,
          onClick: () => fightTile(menu, board, setBoard, setMenu, endTurn),
        });
      items.push({ label: 'Cancel', onClick: endTurn });
      return (
        <GameMenu title="Pay or Fight" items={items}>
          <div>
            This tile is owned by {tile.owner}.<br />
            Fee: {fee} GP
            <br />
            Defence: {defence} U
          </div>
        </GameMenu>
      );
    }
    return null;
  }

  return (
    <div className="App">
      <h1>Heroes of the Lake</h1>
      <header
        className="App-header"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          {board && <BoardCanvas board={board} />}
          {board && <PlayerStatsTable board={board} />}
        </div>
        <div style={{ minWidth: 240 }}>
          {(board && menu && renderGameMenu()) || <div style={{ minWidth: 240 }}></div>}
        </div>
      </header>
    </div>
  );
}

export default App;
