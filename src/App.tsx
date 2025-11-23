import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { Tile } from './game/Tile';
import { Player } from './game/Player';
import { Board } from './game/Board';
import { BoardCanvas } from './components/BoardCanvas';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { PlayerStatsTable } from './components/PlayerStatsTable';
import { GameMenuRenderer } from './components/GameMenuRenderer';
import { MenuState } from './types/menuState';

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

      // Find King Castle (always first)
      const kingCastle = tilesData.find((t: any) => t.name.includes('King Castle'));
      if (!kingCastle) throw new Error('King Castle tile not found');

      // Separate ownable and special tiles
      const ownableTiles = tilesData.filter((t: any) => t.isOwnable);
      const treasureBox = tilesData.find((t: any) => t.name.includes('Treasure box'));
      const rogueCamp = tilesData.find((t: any) => t.name.includes('Rogue camp'));
      const prison = tilesData.find((t: any) => t.name.includes('Prison'));

      // Build tile array: King Castle first, then ownable tiles (each once), then specials
      const tileTemplates: any[] = [kingCastle];
      tileTemplates.push(...ownableTiles); // Each ownable tile once
      if (treasureBox) {
        tileTemplates.push(treasureBox, treasureBox); // Treasure box twice
      }
      if (rogueCamp) {
        tileTemplates.push(rogueCamp, rogueCamp); // Rogue camp twice
      }
      if (prison) {
        tileTemplates.push(prison); // Prison once
      }

      // Shuffle all tiles except the first one (King Castle)
      const shuffledRest = shuffle(tileTemplates.slice(1));
      const finalTemplates = [tileTemplates[0], ...shuffledRest];

      const tiles = finalTemplates.map((t: any) => new Tile(t));
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
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
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
