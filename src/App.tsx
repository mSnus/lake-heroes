import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';
import './styles/dice.css';
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
import ResetGameButton from './components/ResetGameButton';
import { Dice } from './game/Dice';
import { TurnPhase } from './game/Board';
import { CurrentTile } from './components/CurrentCard';
import { CurrentPlayer } from './components/CurrentPlayer';

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    // Allow components to request phase changes via CustomEvent('setPhase', { detail: 'before-move' | ... })
    function onSetPhase(e: Event) {
      const phase = (e as CustomEvent).detail as TurnPhase;
      if (!(phase === 'before-move' || phase === 'rolling' || phase === 'after-move')) return;
      if (!board) return;
      // commit new Board instance preserving prototype and dice instance
      const mutated = Object.assign(new Board(board.tiles, board.players), {
        ...board,
        turnPhase: phase,
      }) as Board;
      // preserve dice instance if any
      mutated.dice = board.dice || new Dice();
      setBoard(mutated);
    }
    window.addEventListener('setPhase', onSetPhase as EventListener);
    return () => window.removeEventListener('setPhase', onSetPhase as EventListener);
  }, [board, setBoard]);

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

        restored.dice = new Dice();
        if (savedRaw.dice && typeof savedRaw.dice.visible !== 'undefined') {
          restored.dice.visible = !!savedRaw.dice.visible;
        }

        if (!restored.turnPhase) restored.turnPhase = 'before-move';

        setBoard(restored);
        setMenu({ type: 'main' });

        window.setTimeout(
          () => window.dispatchEvent(new CustomEvent('setPhase', { detail: restored.turnPhase })),
          0
        );

        const first = restored.activePlayer;
        if (!first.turnsToSkip || first.turnsToSkip <= 0) {
          say(`${first.name}'s turn`, 'info');
        }
        return;
      }

      
      const allTemplates: any[] = (tilesData as any[]).slice();
      const placedTemplates = buildTileLayoutFromTemplates(allTemplates);

      const tiles = placedTemplates.map((t) =>
        t ? new Tile(t) : (undefined as any)
      ) as unknown as Tile[];
      const players = (playersData as any[]).map((p: any) => new Player(p));
      const initialBoard = new Board(tiles, players);

      setBoard(initialBoard);
      setMenu({ type: 'main' });

      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent('setPhase', { detail: initialBoard.turnPhase })),
        0
      );

      const first = initialBoard.activePlayer;

      if (first.turnsToSkip && first.turnsToSkip > 0) {
        say(
          `${first.name} is skipping their turn (${first.turnsToSkip} turn${
            first.turnsToSkip > 1 ? 's' : ''
          } left)`,
          'info'
        );

        first.turnsToSkip -= 1;
        setBoard(Object.setPrototypeOf({ ...initialBoard }, Board.prototype));
        // Advance to next player
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('setPhase', { detail: 'before-move' }));
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('endTurn'));
          }, 0);
        }, 0);
        return;
      }

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

      {board && (
        <div
          id="mainContainer"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <DiceWidget board={board} setBoard={setBoard} />
          <CurrentTile board={board} />
          <BoardCanvas board={board} />
          <CurrentPlayer board={board} />

          {menu ? (
            <GameMenuRenderer board={board} menu={menu} setMenu={setMenu} setBoard={setBoard} />
          ) : (
            <div className="game-menu"></div>
          )}

          <PlayerStatsTable board={board} setBoard={setBoard} />
        </div>
      )}

      <ResetGameButton />
    </div>
  );
}

export default App;
