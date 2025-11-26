import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { Tile } from './game/Tile';
import { Player } from './game/Player';
import { Board } from './game/Board';
import { BoardCanvas } from './components/BoardCanvas';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { say } from './utils/say';
import { PlayerStatsTable } from './components/PlayerStatsTable';
import { GameMenuRenderer } from './components/GameMenuRenderer';
import { MenuState } from './types/menuState';
import tilesData from './settings/tiles.json';
import playersData from './settings/players.json';
import { buildTileLayoutFromTemplates } from './components/board/layout';
import {isMobileLayout} from './components/board/common';



function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    function loadGameData() {
      const saved = loadFromStorage('board-state', null);
      if (saved) {
        const restored = Object.assign(new Board([], []), saved) as Board;
        setBoard(restored);
        setMenu({ type: 'main' });
        // Announce starting player's turn if not skipped
        const first = restored.activePlayer;
        if (!first.turnsToSkip || first.turnsToSkip <= 0) {
          say(`${first.name}'s turn`, 'info');
        }
        return;
      }

      // Build full template list from settings
      const allTemplates: any[] = (tilesData as any[]).slice();
      const placedTemplates = buildTileLayoutFromTemplates(allTemplates);

      // Map to Tile instances; leave blanks as undefined
      const tiles = placedTemplates.map((t) => (t ? new Tile(t) : (undefined as any))) as unknown as Tile[];
      const players = (playersData as any[]).map((p: any) => new Player(p));
      const initialBoard = new Board(tiles, players);
      setBoard(initialBoard);
      setMenu({ type: 'main' });
      // Announce starting player's turn if not skipped
      const first = initialBoard.activePlayer;
      if (!first.turnsToSkip || first.turnsToSkip <= 0) {
        say(`${first.name}'s turn`, 'info');
      }
    }
    loadGameData();
  }, []);

  useEffect(() => {
    if (board) saveToStorage('board-state', board);
  }, [board]);


  return (
    <div className="App">
      <ToastContainer position={isMobileLayout() ? "bottom-center" : "top-right"} autoClose={3500} hideProgressBar={true} />

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

      {/* Reset Game button fixed at the bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          padding: '12px 0',
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
        }}
      >
        <button
          onClick={() => {
            try {
              localStorage.removeItem('board-state');
            } catch (e) {
              // ignore storage errors
            } finally {
              window.location.reload();
            }
          }}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid #ccc',
            cursor: 'pointer',
            background: '#fff',
            color: '#333',
            fontWeight: 600,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          Reset Game
        </button>
      </div>
    </div>
  );
}

export default App;
