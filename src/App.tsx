import React, { useEffect, useState } from 'react';
import './App.css';
import { Tile } from './game/Tile';
import { Player } from './game/Player';
import { Board } from './game/Board';
import { BoardCanvas } from './components/BoardCanvas';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { PlayerStatsTable } from './components/PlayerStatsTable';
import { GameMenuRenderer } from './components/GameMenuRenderer';
import { MenuState } from './types/menuState';

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


  return (
    <div className="App">
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
          {board && menu ? (
            <GameMenuRenderer board={board} menu={menu} setMenu={setMenu} setBoard={setBoard} />
          ) : (
            <div style={{ minWidth: 240 }}></div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
