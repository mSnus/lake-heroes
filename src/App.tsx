import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';

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
import { CurrentTile } from './components/CurrentTile';
import { CurrentPlayer } from './components/CurrentPlayer';
import { gameStart } from './actions/gameStart';
import GameMessage from './components/GameMessage';
import BuyUnitsModal from './components/BuyUnitsModal';
import NewGameModal, { PlayerSetup } from './components/NewGameModal';
import MessageHistoryModal, { LogMessage } from './components/MessageHistoryModal';
import { gameEvent } from './utils/events';
import { afterMoveLogic } from './actions/afterMoveLogic';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [showNewGameModal, setShowNewGameModal] = useState(true);
  const [showDice, setShowDice] = useState(true);
  const [messageHistory, setMessageHistory] = useState<LogMessage[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);

  // setPhase event listener and handler
  function onSetPhase(e: Event) {
    if (!gameState) return;

    const phase = (e as CustomEvent).detail as TurnPhase;

    if (!['before-move', 'rolling', 'moving', 'after-move'].includes(phase)) return;

    if (phase === 'rolling') {
      setShowDice(true);
    }

    gameState.setPhase(phase);
    if (phase === 'after-move') {
      gameState.incTurns();
    }

    setGameState(gameState);
  }

  window.addEventListener('setPhase', onSetPhase as EventListener);

  useEffect(() => {
    const handleLogMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail as LogMessage;
      setMessageHistory((prev) => [...prev, detail]);
    };

    window.addEventListener('logMessage', handleLogMessage);
    return () => window.removeEventListener('logMessage', handleLogMessage);
  }, []);

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

        if (!restored.turnPhase) restored.turnPhase = 'before-move';

        setGameState(restored);
        // setMenu({ type: 'main' });
        afterMoveLogic(restored, updateGameState, setMenu);
        setShowNewGameModal(false);

        window.setTimeout(() => gameEvent('setPhase', restored.turnPhase), 0);

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

      window.setTimeout(() => gameEvent('setPhase', initialGameState.turnPhase), 0);

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

    setGameState(newGameState);
  };

  const handleBuyUnits = (amount: number) => {
    if (!gameState) return;
    const player = gameState.activePlayer;
    const cost = amount * 100;
    if (player.gold >= cost) {
      player.gold -= cost;
      player.units += amount;
      say(`${player.name} bought ${amount} units for ${cost} gold.`, 'success');
      updateGameState(gameState);
    } else {
      say('Not enough gold to buy units.', 'error');
    }
    setMenu({ type: 'end-turn' });
  };

  const handleSkipBuyUnits = () => {
    setMenu({ type: 'end-turn' });
  };

  const handleStartGame = (playersSetup: PlayerSetup[]) => {
    // Create a new GameState with the configuration from the modal
    const newPlayers = playersSetup.map((p) => new Player(p));
    const newGameState = { ...gameState, tiles: gameState?.tiles, players: newPlayers };

    updateGameState(newGameState);
    setShowNewGameModal(false); // Hide the modal
    setShowDice(false);
  };

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

      {gameState && (
        <div
          id="mainContainer"
        >
          {showDice && <DiceWidget gameState={gameState} />}
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

          {showNewGameModal && <NewGameModal onStart={handleStartGame} />}

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

      <NewGameButton />
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
