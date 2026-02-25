import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';

import { Player } from './game/Player';
import { GameState, TurnPhase } from './game/GameState';
import { TileJSON } from './game/Tile';
import { BoardCanvas } from './components/BoardCanvas';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { say } from './utils/say';
import { PlayerStatsTable } from './components/PlayerStatsTable';
import { GameMenuRenderer } from './components/GameMenuRenderer';
import { MenuState } from './types/menuState';
import tilesData from './settings/tiles.json';
import { buildTilesFromTemplates, rehydrateSavedTiles, SavedGameState } from './game/TileSet';
import { isMobileLayout } from './components/board/common';
import NewGameButton from './components/NewGameButton';
import { CurrentTile } from './components/CurrentTile';
import { CurrentPlayer } from './components/CurrentPlayer';
import { gameStart } from './actions/gameStart';
import GameMessage from './components/GameMessage';
import BuyUnitsModal from './components/BuyUnitsModal';
import { PlayerSetup } from './utils/playerSetup';
import MessageHistoryModal, { LogMessage } from './components/MessageHistoryModal';
import { gameEvent } from './utils/events';
import { afterMoveLogic } from './actions/afterMoveLogic';
import { ModalRenderer } from './components/ModalRenderer';
import { showModal } from './utils/modalStore';
import { rollAndMove } from './actions/rollAndMove';
import { buyUnits } from './actions/buyUnits';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [messageHistory, setMessageHistory] = useState<LogMessage[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);

  // Always-current ref so dice/action closures never capture stale state
  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const updateGameState = useCallback((gs: GameState | null): void => {
    if (!gs) return;
    const newGameState = Object.assign(
      new GameState(gs.tiles || [], gs.players || []),
      { ...gs }
    ) as GameState;
    setGameState(newGameState);
  }, []);

  const handleDiceRollAndMove = useCallback(function (roll: number) {
    rollAndMove(gameStateRef.current, updateGameState, setMenu, roll);
  }, [updateGameState]);

  // setPhase event listener and handler
  const onSetPhase = useCallback(
    (e: Event) => {
      const current = gameStateRef.current;
      if (!current) return;

      const phase = (e as CustomEvent).detail as TurnPhase;

      if (!['before-move', 'rolling', 'moving', 'after-move'].includes(phase)) return;

      if (phase === 'rolling') {
        console.debug('dice from phase');
        showModal('dice', handleDiceRollAndMove);
      }

      current.setPhase(phase);
      if (phase === 'after-move') {
        current.incTurns();
      }

      setGameState(current);
    },
    [handleDiceRollAndMove]
  );
  // register listener in effect so it's added/removed with lifecycle
  useEffect(() => {
    window.addEventListener('setPhase', onSetPhase as EventListener);
    return () => window.removeEventListener('setPhase', onSetPhase as EventListener);
  }, [onSetPhase]);

  useEffect(() => {
    const handleLogMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail as LogMessage;
      setMessageHistory((prev) => [...prev, detail]);
    };

    window.addEventListener('logMessage', handleLogMessage);
    return () => window.removeEventListener('logMessage', handleLogMessage);
  }, []);

  const didInit = useRef(false);

  useEffect(() => {
    function loadGameData() {
      if (didInit.current) return;
      didInit.current = true;

      console.warn('Setting up game data...');

      const saved = loadFromStorage('game-state', null);
      if (saved) {
        say('Restoring saved game...', 'info');

        // Rehydrate tiles and players so we preserve class methods (e.g. Tile.isOwned)
        const savedRaw = saved as SavedGameState;
        // use TileSet helper to convert saved plain objects into Tile instances
        const tiles = rehydrateSavedTiles(savedRaw);
        const players = (savedRaw.players || []).map((p) => new Player(p));
        const restored = Object.assign(new GameState(tiles, players), {
          ...savedRaw,
          tiles,
          players,
        });

        if (!restored.turnPhase) restored.turnPhase = 'before-move';

        setGameState(restored);

        afterMoveLogic(restored, updateGameState, setMenu);
        console.debug('dice from restore');
        showModal('dice', handleDiceRollAndMove);

        gameEvent('setPhase', restored.turnPhase);

        const first = restored.activePlayer;
        if (!first.turnsToSkip || first.turnsToSkip <= 0) {
          say(`${first.name}'s turn`, 'info');
        }

        return;
      }

      showModal('new-game', handleStartGame);
    }
    loadGameData();
  }, []);

  useEffect(() => {
    if (gameState) saveToStorage('game-state', gameState);
  }, [gameState]);

  const handleBuyUnits = useCallback((amount: number) => {
    buyUnits(gameStateRef.current, amount, updateGameState, setMenu);
  }, [updateGameState]);

  const handleSkipBuyUnits = () => {
    setMenu({ type: 'end-turn' });
  };

  const handleStartGame = useCallback(
    (playersSetup: PlayerSetup[]) => {
      console.log('Starting new game');

      const tiles = buildTilesFromTemplates(tilesData as TileJSON[]);
      const players = playersSetup.map((p) => new Player(p));
      const initialGameState = new GameState(tiles, players);
      gameStart(initialGameState, updateGameState);

      gameEvent('setPhase', initialGameState.turnPhase);
      say(`${initialGameState.activePlayer.name}, start the game by rolling the dice!`, 'info');

      console.debug('dice from handleStartGame');
      showModal('dice', handleDiceRollAndMove);
    },
    [updateGameState]
  );

  const handleOpenLog = () => {
    setShowLogModal(true);
  };

  const handleCloseLog = () => {
    setShowLogModal(false);
  };

  return (
    <div className="App">
      <ToastContainer
        position={isMobileLayout() ? 'top-center' : 'top-right'}
        autoClose={3500}
        hideProgressBar={true}
      />

      <ModalRenderer />

      {gameState?.gameOver && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#ffe066', fontSize: '2.5rem', textAlign: 'center',
            gap: '1.5rem',
          }}
        >
          <div>🐉 {gameState.gameMessage} 🐉</div>
          <button
            style={{ fontSize: '1.2rem', padding: '0.6rem 2rem', cursor: 'pointer' }}
            onClick={() => showModal('new-game', handleStartGame)}
          >
            New Game
          </button>
        </div>
      )}

      {gameState && (
        <div id="mainContainer">
          <CurrentPlayer gameState={gameState} />
          <GameMessage message={gameState.gameMessage} />
          <CurrentTile gameState={gameState} updateGameState={updateGameState} />
          {menu && gameState.turnPhase !== 'moving' && menu.type !== 'buy-units' ? (
            <GameMenuRenderer
              board={gameState}
              menu={menu}
              setMenu={setMenu}
              updateGameState={updateGameState}
              top={gameState.gameMessage ? '60px' : '30px'}
            />
          ) : (
            <div className="game-menu"></div>
          )}
          <BoardCanvas board={gameState} />

          {menu && menu.type === 'buy-units' && (
            <BuyUnitsModal
              gameState={gameState}
              onBuy={handleBuyUnits}
              onSkip={handleSkipBuyUnits}
            />
          )}

          {showLogModal && (
            <MessageHistoryModal messages={messageHistory} onClose={handleCloseLog} />
          )}

          <PlayerStatsTable gameState={gameState} updateGameState={updateGameState} />
        </div>
      )}

      <NewGameButton onClick={() => showModal('new-game', handleStartGame)} />
      <div
        className="shield-button-container"
        style={{
          top: '50px',
        }}
      >
        <button
          id="btnGamelog"
          onClick={handleOpenLog}
          className="shield-button"
          title="Show Game Log"
        >
          📜
        </button>
      </div>
    </div>
  );
}

export default App;
