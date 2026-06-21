import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';

import { Player } from './game/Player';
import { GameState, TurnPhase } from './game/GameState';
import { Tile, TileJSON } from './game/Tile';
import { BoardCanvas } from './components/BoardCanvas';
import { PlayerLabel } from './components/PlayerLabel';
import { CurrentPlayerCard } from './components/CurrentPlayerCard';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { say } from './utils/say';
import { OwnedTiles } from './components/OwnedTiles';
import tilesData from './settings/tiles.json';
import { buildTilesFromTemplates, rehydrateSavedTiles, SavedGameState } from './game/TileSet';
import { isMobileLayout } from './components/board/common';
import { CurrentTile } from './components/CurrentTile';
import { gameStart } from './actions/gameStart';
import GameMessage from './components/GameMessage';
import { PlayerSetup } from './utils/playerSetup';
import GameLogModal, { LogMessage } from './components/GameLogModal';
import { gameEvent } from './utils/events';
import { afterMoveLogic } from './actions/afterMoveLogic';
import { ModalRenderer } from './components/ModalRenderer';
import { BotController } from './components/BotController';
import { showDice } from './utils/diceStore';
import { requestShakeToRollPermission } from './utils/useShakeToRoll';
import {
  useScreen,
  showScreen,
  clearScreen,
  showPrisonScreen,
  showTreasureScreen,
  showTavernScreen,
  showSphynxScreen,
  showJokerScreen,
  showDragonSkyScreen,
  showDragonAttackScreen,
  showDragonChallengeScreen,
  SavedScreen,
} from './utils/screenStore';
import { handleSphynx } from './actions/sphynx';
import { handleTavern } from './actions/tavern';
import { handleTreasureBox } from './actions/treasureBox';
import { fightDragon } from './actions/fightDragon';
import { BattleScreen } from './components/BattleScreen';
import NewGameModal from './components/NewGameModal';
import { rollAndMove } from './actions/rollAndMove';
import { UNIT_PRICE, DRAGON_GOLD } from './game/constants';
import { resetEndTurn, setEndTurn } from './utils/endTurnStore';
import { ActionBar } from './components/ActionBar';
import { ShieldColumn } from './components/ShieldColumn';
import { ScreenRenderer } from './components/ScreenRenderer';
import { DecoratedButton } from './components/DecoratedButton';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<LogMessage[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const screen = useScreen();

  // Always-current ref so dice/action closures never capture stale state
  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const updateGameState = useCallback((gs: GameState | null): void => {
    if (!gs) return;
    const newGameState = Object.assign(new GameState(gs.tiles || [], gs.players || []), {
      ...gs,
    }) as GameState;
    setGameState(newGameState);
  }, []);

  const handleDiceRollAndMove = useCallback(
    function (roll: number) {
      resetEndTurn();
      rollAndMove(gameStateRef.current, updateGameState, roll);
    },
    [updateGameState]
  );

  // setPhase event listener and handler
  const onSetPhase = useCallback((e: Event) => {
    const current = gameStateRef.current;
    if (!current) return;

    const phase = (e as CustomEvent).detail as TurnPhase;

    if (!['before-move', 'rolling', 'moving', 'after-move'].includes(phase)) return;

    current.setPhase(phase);
    setGameState(current);
  }, []);
  useEffect(() => {
    window.addEventListener('setPhase', onSetPhase as EventListener);
    return () => window.removeEventListener('setPhase', onSetPhase as EventListener);
  }, [onSetPhase]);

  // showDice event: fired by endTurn/dragon to open the dice modal with the correct handler
  useEffect(() => {
    const handler = () => showDice(handleDiceRollAndMove);
    window.addEventListener('showDice', handler);
    return () => window.removeEventListener('showDice', handler);
  }, [handleDiceRollAndMove]);

  useEffect(() => {
    const handleLogMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail as LogMessage;
      setGameLog((prev) => [...prev, detail]);
    };

    window.addEventListener('logMessage', handleLogMessage);
    return () => window.removeEventListener('logMessage', handleLogMessage);
  }, []);

  // Dev tool: reload tile definitions from tiles.json without resetting the game.
  // Usage from browser console: await __reloadTiles()
  useEffect(() => {
    (window as any).__reloadTiles = async () => {
      const gs = gameStateRef.current;
      if (!gs) {
        console.warn('__reloadTiles: no active game state');
        return;
      }

      const res = await fetch('/src/settings/tiles.json');
      if (!res.ok) throw new Error(`Failed to fetch tiles.json: ${res.status}`);
      const freshTemplates: TileJSON[] = await res.json();

      const byName = new Map<string, TileJSON>(freshTemplates.map((t) => [t.name, t]));

      // Rebuild each tile from fresh JSON but carry over runtime state
      const updatedTiles = gs.tiles.map((tile) => {
        const fresh = byName.get(tile.name);
        if (!fresh) return tile;
        return new Tile({ ...fresh, owner: tile.owner, level: tile._level });
      });

      updateGameState({ ...gs, tiles: updatedTiles } as GameState);
      console.log(`[reloadTiles] ${updatedTiles.length} tiles refreshed from tiles.json`);
    };

    return () => {
      delete (window as any).__reloadTiles;
    };
  }, [updateGameState]);

  // Preload individual sprite PNGs so they're cached before tiles render
  useEffect(() => {
    (tilesData as TileJSON[]).forEach((t) => {
      if (t.spriteImage) {
        const img = new Image();
        img.src = t.spriteImage;
      }
    });
  }, []);

  const didInit = useRef(false);

  useEffect(() => {
    function loadGameData() {
      if (didInit.current) return;
      didInit.current = true;

      const saved = loadFromStorage('game-state', null);
      if (saved) {
        try {
          say('Restoring saved game...', 'info');

          const savedRaw = saved as SavedGameState;
          const tiles = rehydrateSavedTiles(savedRaw);
          // new Player() resets ownedTiles/turnsToSkip/circles/etc; copy the
          // saved fields back so per-player state survives a reload. The 1-based
          // id is derived from array order, which is stable across save/load.
          const players = (savedRaw.players || []).map((p, i) =>
            Object.assign(new Player(p), p, { id: i + 1 })
          );
          const restored = Object.assign(new GameState(tiles, players), {
            ...savedRaw,
            tiles,
            players,
          });

          if (!restored.turnPhase) restored.turnPhase = 'before-move';

          setGameState(restored);

          const savedScreen = loadFromStorage<SavedScreen | null>('game-screen', null);
          if (savedScreen) {
            switch (savedScreen.type) {
              case 'prison':
                showPrisonScreen(savedScreen.message ?? '', '');
                break;
              case 'joker':
                showJokerScreen(savedScreen.message ?? '');
                break;
              case 'dragon':
                showDragonChallengeScreen(
                  savedScreen.htmlMessage ?? savedScreen.message ?? '',
                  () => fightDragon(restored, updateGameState),
                  () => gameEvent('showDice', null)
                );
                break;
              case 'caravan':
                showScreen({
                  screenType: 'caravan',
                  background: 'assets/screens/caravan.jpg',
                  caravanDefence: savedScreen.caravanDefence,
                  caravanPrize: savedScreen.caravanPrize,
                  message: savedScreen.message,
                  buttons: [
                    {
                      label: 'Attack!',
                      onClick: () =>
                        showScreen({
                          screenType: 'caravan-battle',
                          caravanDefence: savedScreen.caravanDefence,
                          caravanPrize: savedScreen.caravanPrize,
                          content: (
                            <BattleScreen
                              mode="caravan"
                              attacker={restored.activePlayer}
                              gameState={restored}
                              updateGameState={updateGameState}
                              caravanDefence={savedScreen.caravanDefence!}
                              caravanPrize={savedScreen.caravanPrize!}
                              onClose={() => gameEvent('showDice', null)}
                            />
                          ),
                        }),
                    },
                    {
                      label: 'Let it pass..',
                      onClick: () => {
                        clearScreen();
                        gameEvent('showDice', null);
                      },
                    },
                  ],
                });
                break;
              case 'caravan-battle':
                showScreen({
                  screenType: 'caravan-battle',
                  caravanDefence: savedScreen.caravanDefence,
                  caravanPrize: savedScreen.caravanPrize,
                  content: (
                    <BattleScreen
                      mode="caravan"
                      attacker={restored.activePlayer}
                      gameState={restored}
                      updateGameState={updateGameState}
                      caravanDefence={savedScreen.caravanDefence!}
                      caravanPrize={savedScreen.caravanPrize!}
                      onClose={() => gameEvent('showDice', null)}
                    />
                  ),
                });
                break;
              case 'portal':
                showScreen({
                  screenType: 'portal',
                  background: 'assets/screens/portal.jpg',
                  spriteImage: restored.activeTile.spriteImage,
                  message: savedScreen.message,
                  buttons: [
                    {
                      label: 'Continue',
                      onClick: () => {
                        clearScreen();
                        afterMoveLogic(restored, updateGameState);
                      },
                    },
                  ],
                });
                break;
              case 'dragon-sky':
                showDragonSkyScreen(
                  () => gameEvent('showDice', null),
                  restored.activePlayer.name,
                  restored.activePlayer.color
                );
                break;
              case 'dragon-attack':
                showDragonAttackScreen(savedScreen.message ?? '', () =>
                  gameEvent('showDice', null)
                );
                break;
              case 'dragon-battle':
                showScreen({
                  screenType: 'dragon-battle',
                  content: (
                    <BattleScreen
                      mode="dragon"
                      attacker={restored.activePlayer}
                      gameState={restored}
                      updateGameState={updateGameState}
                    />
                  ),
                });
                break;
              case 'sphynx':
                showSphynxScreen((roll) => handleSphynx(restored, updateGameState, roll));
                break;
              case 'sphynx-result':
                showScreen({
                  screenType: 'sphynx-result',
                  background: 'assets/screens/sphynx.jpg',
                  fade: true,
                  message: savedScreen.message,
                  buttons: [
                    {
                      label: 'Continue',
                      action: 'end-turn',
                      onClick: () => {
                        clearScreen();
                        setEndTurn();
                      },
                    },
                  ],
                });
                break;
              case 'tavern':
                showTavernScreen(savedScreen.title ?? '', (roll) =>
                  handleTavern(restored, updateGameState, roll)
                );
                break;
              case 'tavern-result':
                showScreen({
                  screenType: 'tavern-result',
                  background: 'assets/screens/tavern.jpg',
                  message: savedScreen.message,
                  buttons: [
                    {
                      label: 'New folks are always welcome!',
                      action: 'end-turn',
                      onClick: () => {
                        clearScreen();
                        setEndTurn();
                      },
                    },
                  ],
                });
                break;
              case 'treasure':
                showTreasureScreen(savedScreen.title ?? 'Treasures', (roll) =>
                  handleTreasureBox(restored, updateGameState, roll)
                );
                break;
              case 'treasure-result':
                showScreen({
                  screenType: 'treasure-result',
                  background: 'assets/screens/treasure.jpg',
                  message: savedScreen.message,
                  fade: true,
                  buttons: [
                    {
                      label: 'Let the treasures grow!',
                      action: 'end-turn',
                      onClick: () => {
                        clearScreen();
                        setEndTurn();
                      },
                    },
                  ],
                });
                break;
              default:
                if (restored.skippingTurn) {
                  setEndTurn();
                } else if (restored.turnPhase === 'before-move') {
                  showDice(handleDiceRollAndMove);
                } else {
                  afterMoveLogic(restored, updateGameState);
                }
            }
          } else if (restored.skippingTurn) {
            setEndTurn();
          } else if (restored.turnPhase === 'before-move') {
            showDice(handleDiceRollAndMove);
          } else {
            afterMoveLogic(restored, updateGameState);
          }

          gameEvent('setPhase', restored.turnPhase);

          const first = restored.activePlayer;
          if (!first.turnsToSkip || first.turnsToSkip <= 0) {
            say(`${first.name}'s turn`, 'info');
          }

          return;
        } catch (e) {
          console.error('Failed to restore saved game, starting fresh:', e);
          localStorage.removeItem('game-state');
        }
      }

      showScreen({ content: <NewGameModal onStart={handleStartGame} /> });
    }

    loadGameData();
  }, []);

  useEffect(() => {
    if (!gameState) return;
    saveToStorage('game-state', gameState);
    if (screen?.screenType && !screen?.doNotPersist) {
      saveToStorage<SavedScreen>('game-screen', {
        type: screen.screenType,
        message: screen.message,
        htmlMessage: screen.htmlMessage,
        title: screen.title,
        caravanDefence: screen.caravanDefence,
        caravanPrize: screen.caravanPrize,
      });
    } else {
      localStorage.removeItem('game-screen');
    }
  }, [gameState, screen]);

  const handleStartGame = useCallback(
    (playersSetup: PlayerSetup[]) => {
      const tiles = buildTilesFromTemplates(tilesData as TileJSON[]);
      const players = playersSetup.map((p, i) => new Player({ ...p, id: i + 1 }));
      const initialGameState = new GameState(tiles, players);
      gameStart(initialGameState, updateGameState);

      // "Start Game" is a real user gesture, which iOS requires before it
      // will grant devicemotion access for shake-to-roll.
      requestShakeToRollPermission();

      clearScreen();
      gameEvent('setPhase', initialGameState.turnPhase);
      say(`${initialGameState.activePlayer.name}, start the game by rolling the dice!`, 'info');
      showDice(handleDiceRollAndMove);
    },
    [updateGameState]
  );

  const handleOpenLog = () => setShowLogModal(true);
  const handleCloseLog = () => setShowLogModal(false);

  return (
    <div className="App">
      <ToastContainer
        position={isMobileLayout() ? 'top-center' : 'top-right'}
        autoClose={3500}
        hideProgressBar={true}
        closeOnClick={true}
      />

      <ModalRenderer />
      <BotController gameState={gameState} updateGameState={updateGameState} />

      {!gameState && screen?.content && <>{screen.content}</>}

      {gameState?.gameOver &&
        (() => {
          const winner = gameState.activePlayer;
          const tilesGold = winner.ownedTiles.reduce((sum, idx) => {
            const t = gameState.tiles[idx];
            return t && t.owner === winner.id ? sum + t.currentPrice.gold : sum;
          }, 0);
          const totalGold = winner.gold + tilesGold + winner.units * UNIT_PRICE + DRAGON_GOLD;
          const years = winner.circles;

          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background:
                  'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url(assets/screens/game_won.jpg) center/cover no-repeat',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffe066',
                textAlign: 'center',
                gap: '1.5rem',
                padding: '24px',
              }}
            >
              <div className="text-title">Glorious victory!</div>
              <div
                style={{
                  fontSize: '1.5rem',
                  maxWidth: '640px',
                  lineHeight: 1.5,
                  textShadow: '1px 1px 6px #000',
                  fontFamily: 'Texturina',
                }}
              >
                Oh mighty <PlayerLabel player={winner} />,<br />
                it took you {years} years to slain that dragon!
                <br />
                <i style={{ fontSize: '0.8rem', fontFamily: 'Texturina' }}>
                  Boromir would do it in only {years - 1}...
                </i>
                <br />
                <br />
                You leave that kingdom <br />
                with a fame of {winner.fame}🏆 and {totalGold.toLocaleString()}🟡
                <br />
                <br />
                Congratulations! Time for a new challenge!
              </div>
              <DecoratedButton
                onClick={() => {
                  localStorage.removeItem('game-state');
                  localStorage.removeItem('game-screen');
                  setGameState(null);
                  showScreen({ content: <NewGameModal onStart={handleStartGame} /> });
                }}
              >
                New Game
              </DecoratedButton>
            </div>
          );
        })()}

      {gameState && (
        <div id="mainContainer">
          <div className="board-section">
            {!screen && <GameMessage message={gameState.gameMessage} />}
            <CurrentTile gameState={gameState} updateGameState={updateGameState} />
            <CurrentPlayerCard gameState={gameState} />
            <ScreenRenderer gameState={gameState} updateGameState={updateGameState} />
            <BoardCanvas board={gameState} updateGameState={updateGameState} />
            <ShieldColumn
              gameState={gameState}
              updateGameState={updateGameState}
              onOpenLog={handleOpenLog}
            />
          </div>

          <div className="side-pane">
            <ActionBar gameState={gameState} updateGameState={updateGameState} />

            {showLogModal && <GameLogModal messages={gameLog} onClose={handleCloseLog} />}

            {!screen?.sellMode && (
              <OwnedTiles gameState={gameState} updateGameState={updateGameState} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
