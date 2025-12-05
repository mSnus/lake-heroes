import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';
import './styles/dice.css';

import { Player } from './game/Player';
import { GameState, TurnPhase } from './game/GameState';
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
import NewGameButton from './components/NewGameButton';
import { Dice } from './game/Dice';
import { CurrentTile } from './components/CurrentTile';
import { CurrentPlayer } from './components/CurrentPlayer';
import { gameStart } from './actions/gameStart';
import GameMessage from './components/GameMessage';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  // setPhase event listener and handler
  function onSetPhase(e: Event) {
    if (!gameState) return;

    const phase = (e as CustomEvent).detail as TurnPhase;

    if (!['before-move', 'rolling', 'moving', 'after-move'].includes(phase)) return;

    gameState.setPhase(phase);
    if (phase === 'after-move') {
      gameState.incTurns();
    }

    setGameState(gameState);
  }

  window.addEventListener('setPhase', onSetPhase as EventListener);

  useEffect(() => {
    function loadGameData() {
      console.warn('Loading game data...');
      const saved = loadFromStorage('game-state', null);
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
      gameStart(initialGameState, updateGameState);

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
    if (gameState) saveToStorage('game-state', gameState);
  }, [gameState]);

  const updateGameState = (gameState: GameState | null): void => {
    if (!gameState) return;

    const newGameState = Object.assign(
      new GameState(gameState.tiles || [], gameState.players || []),
      {
        ...gameState,
      }
    ) as GameState;

    // Preserve dice instance if present on the original gameState
    newGameState.dice = (gameState as any).dice || new Dice();

    setGameState(newGameState);
  };

  return (
    <div className="App">
      <ToastContainer
        position={isMobileLayout() ? 'top-center' : 'top-right'}
        autoClose={3500}
        hideProgressBar={true}
      />

      {gameState && (
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
          <DiceWidget gameState={gameState} />
          <CurrentTile gameState={gameState} />
          <BoardCanvas board={gameState} />

          <div className="board-controls-wrapper">
            <GameMessage message={gameState.gameMessage} />

            <div className="board-controls">
              <CurrentPlayer gameState={gameState} />

              {menu && gameState.turnPhase !== 'moving' ? (
                <div>
                  <GameMenuRenderer
                    board={gameState}
                    menu={menu}
                    setMenu={setMenu}
                    updateGameState={updateGameState}
                  />
                </div>
              ) : (
                <div className="game-menu"></div>
              )}
            </div>
          </div>

          <PlayerStatsTable gameState={gameState} updateGameState={updateGameState} />
        </div>
      )}

      <NewGameButton />
    </div>
  );
}

export default App;
