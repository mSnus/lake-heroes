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

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Place tiles according to rules:
// - Fixed placements (1-based positions):
//   #1 King Castle, #8 Treasure box, #13 Prison, #17 Treasure box, #20 Freelancers' camp
// - Remaining tiles placed from a randomized stack
// - No adjacent tiles of the same group unless there are no alternatives left
// - If not enough tiles to fill, leave remaining slots blank (undefined)
function buildTileLayoutFromTemplates(allTemplates: any[]): (any | undefined)[] {
  const SLOT_COUNT = 24; // rectangular path 8x6 perimeter

  // Helper: find by name contains
  const byName = (substr: string) =>
    (allTemplates as any[]).find((t) => typeof t?.name === 'string' && t.name.includes(substr));

  const kingCastle = byName('King Castle');
  const prison = byName('Prison');
  const treasureBox = byName('Treasure box');
  const freelancers = byName("Freelancers' camp");

  if (!kingCastle) throw new Error('King Castle tile not found');
  if (!treasureBox) throw new Error('Treasure box tile not found');
  if (!prison) throw new Error('Prison tile not found');
  if (!freelancers) throw new Error("Freelancers' camp tile not found");

  // Prepare slots (0-based indices)
  const slots: (any | undefined)[] = new Array(SLOT_COUNT).fill(undefined);

  // Fixed positions (0-based): 0, 7, 12, 16, 19
  const FIXED: [number, any][] = [
    [0, kingCastle],
    [7, treasureBox],
    [12, prison],
    [16, treasureBox],
    [19, freelancers],
  ];
  FIXED.forEach(([idx, tpl]) => {
    slots[idx] = tpl;
  });

  // Build pool = all templates except the exact fixed ones we already used.
  // Important: treasure box is used twice; remove two from the pool if present.
  const pool: any[] = [];
  let treasureToRemove = 2;
  (allTemplates as any[]).forEach((t) => {
    if (t === kingCastle || t === prison || t === freelancers) return; // used once
    if (t === treasureBox && treasureToRemove > 0) {
      treasureToRemove--;
      return; // skip two copies
    }
    pool.push(t);
  });

  // Randomize stack
  const stack = shuffle(pool);

  // Helper to get neighbor groups for constraint
  const getGroup = (tpl: any | undefined) => (tpl ? tpl.group : undefined);

  // Fill remaining slots respecting adjacency constraint when possible
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (slots[i]) continue; // already fixed

    // Determine disallowed group from neighbors already placed or fixed
    const left = i > 0 ? slots[i - 1] : slots[SLOT_COUNT - 1]; // wrap-around neighbor
    const right = i < SLOT_COUNT - 1 ? slots[i + 1] : slots[0]; // may still be undefined if not placed yet
    const leftGroup = getGroup(left);
    const rightGroup = getGroup(right);

    // Try to find a tile not matching left/right groups
    let pickIndex = -1;
    for (let s = 0; s < stack.length; s++) {
      const g = getGroup(stack[s]);
      if (g !== leftGroup && (rightGroup === undefined || g !== rightGroup)) {
        pickIndex = s;
        break;
      }
    }

    // If none found and we still have tiles, relax the constraint
    if (pickIndex === -1 && stack.length > 0) {
      pickIndex = 0;
    }

    if (pickIndex >= 0) {
      const [picked] = stack.splice(pickIndex, 1);
      slots[i] = picked;
    } else {
      // Out of tiles → leave blank
      slots[i] = undefined;
    }
  }

  return slots;
}

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
      <ToastContainer position="top-right" autoClose={3500} hideProgressBar={false} />

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
