import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './assets/dice.css';
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
import { isMobileLayout } from './components/board/common';
import { DiceWidget } from './components/DiceWidget';

type TurnPhase = 'before-move' | 'rolling' | 'after-move';

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>(
    () => (loadFromStorage('turn-phase', null) as TurnPhase) || 'before-move'
  );

  useEffect(() => {
    // Persist phase whenever it changes
    saveToStorage('turn-phase', turnPhase);
  }, [turnPhase]);

  useEffect(() => {
    // Allow components to request phase changes via CustomEvent('setPhase', { detail: 'before-move' | ... })
    function onSetPhase(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail === 'before-move' || detail === 'rolling' || detail === 'after-move') {
        setTurnPhase(detail);
      }
    }
    window.addEventListener('setPhase', onSetPhase as EventListener);
    return () => window.removeEventListener('setPhase', onSetPhase as EventListener);
  }, []);

  useEffect(() => {
    function loadGameData() {
      const saved = loadFromStorage('board-state', null);
      if (saved) {
        // Rehydrate tiles and players so we preserve class methods (e.g. Tile.isOwned)
        const savedRaw = saved as any;
        const tiles = (savedRaw.tiles || []).map((t: any) =>
          t ? new Tile(t) : (undefined as any)
        ) as unknown as Tile[];
        const players = (savedRaw.players || []).map((p: any) => new Player(p));
        const restored = Object.assign(new Board(tiles, players), {
          ...savedRaw,
          tiles,
          players,
        }) as Board;
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
      const tiles = placedTemplates.map((t) =>
        t ? new Tile(t) : (undefined as any)
      ) as unknown as Tile[];
      const players = (playersData as any[]).map((p: any) => new Player(p));
      const initialBoard = new Board(tiles, players);
      setBoard(initialBoard);
      setMenu({ type: 'main' });
      // ensure default phase on new game
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent('setPhase', { detail: 'before-move' })),
        0
      );
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
      <ToastContainer
        position={isMobileLayout() ? 'bottom-center' : 'top-right'}
        autoClose={3500}
        hideProgressBar={true}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <DiceWidget />
        {board && <BoardCanvas board={board} />}
        {board && <PlayerStatsTable board={board} setBoard={setBoard} />}
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
