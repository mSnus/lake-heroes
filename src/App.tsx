import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';
import './styles/dice.css';
import { Tile } from './game/Tile';
import { Player } from './game/Player';
import { GameState } from './game/GameState';
import { BoardCanvas } from './components/BoardCanvas';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { say } from './utils/say';
import { PlayerStatsTable } from './components/PlayerStatsTable';
import { GameMenuRenderer } from './components/GameMenuRenderer';
import { MenuState } from './types/menuState';
import tilesData from './settings/tiles.json';
import playersData from './settings/players.json';
import { buildTilesFromTemplates, rehydrateSavedTiles } from './game/TileSet';
import { isMobileLayout } from './components/board/common';
import { DiceWidget } from './components/DiceWidget';
import ResetGameButton from './components/ResetGameButton';
import { Dice } from './game/Dice';
import { TurnPhase } from './game/GameState';
import { CurrentTile } from './components/CurrentCard';
import { CurrentPlayer } from './components/CurrentPlayer';
import { gameStart } from './actions/gameStart';

function App() {
  const [board, setGameState] = useState<GameState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    // Allow components to request phase changes via CustomEvent('setPhase', { detail: 'before-move' | ... })
    function onSetPhase(e: Event) {
      const phase = (e as CustomEvent).detail as TurnPhase;
      if (!(phase === 'before-move' || phase === 'rolling' || phase === 'after-move')) return;
      if (!board) return;
      // commit new GameState instance preserving prototype and dice instance
      const mutated = Object.assign(new GameState(board.tiles, board.players), {
        ...board,
        turnPhase: phase,
      }) as GameState;
      // preserve dice instance if any
      mutated.dice = board.dice || new Dice();
      setGameState(mutated);
    }
    window.addEventListener('setPhase', onSetPhase as EventListener);
    return () => window.removeEventListener('setPhase', onSetPhase as EventListener);
  }, [board, setGameState]);

  useEffect(() => {
    function loadGameData() {
      const saved = loadFromStorage('board-state', null);
      if (saved) {
        say('Restoring saved game...', 'info');

        // Rehydrate tiles and players so we preserve class methods (e.g. Tile.isOwned)
        const savedRaw = saved as any;
        // use TileSet helper to convert saved plain objects into Tile instances
        const tiles = rehydrateSavedTiles(savedRaw);
        const players = (savedRaw.players || []).map((p: any) => new Player(p));
        const restored = Object.assign(new GameState(tiles, players), {
          ...savedRaw,
          tiles,
          players,
        }) as GameState;

        restored.dice = new Dice();
        if (savedRaw.dice && typeof savedRaw.dice.visible !== 'undefined') {
          restored.dice.visible = !!savedRaw.dice.visible;
        }

        if (!restored.turnPhase) restored.turnPhase = 'before-move';

        setGameState(restored);
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

      // Build tiles using the new TileSet helper
      const tiles = buildTilesFromTemplates(tilesData);
      const players = (playersData as any[]).map((p: any) => new Player(p));
      const initialGameState = new GameState(tiles, players);
      gameStart(initialGameState);

      setGameState(initialGameState);
      setMenu({ type: 'main' });

      window.setTimeout(
        () =>
          window.dispatchEvent(new CustomEvent('setPhase', { detail: initialGameState.turnPhase })),
        0
      );

      const first = initialGameState.activePlayer;

      say(`${first.name}, start the game by rolling the dice!`, 'info');
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
          <DiceWidget board={board} setGameState={setGameState} />
          <CurrentTile board={board} />
          <BoardCanvas board={board} />
          <CurrentPlayer board={board} />

          {menu ? (
            <GameMenuRenderer
              board={board}
              menu={menu}
              setMenu={setMenu}
              setGameState={setGameState}
            />
          ) : (
            <div className="game-menu"></div>
          )}

          <PlayerStatsTable board={board} setGameState={setGameState} />
        </div>
      )}

      <ResetGameButton />
    </div>
  );
}

export default App;
