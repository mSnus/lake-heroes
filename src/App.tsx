import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';
import './styles/GameMenu.css';

import { Player } from './game/Player';
import { CHARACTER_EMOJI } from './ai/characters';
import { GameState, TurnPhase } from './game/GameState';
import { Tile, TileJSON } from './game/Tile';
import { BoardCanvas } from './components/board/BoardCanvas';
import { PlayerLabel } from './components/snippets/PlayerLabel';
import { CurrentPlayerCard } from './components/board/CurrentPlayerCard';
import { loadFromStorage, saveToStorage, removeFromStorage } from './utils/storage';
import { halt, isHalted, resumeAfterHalt } from './utils/haltStore';
import { resetFogTransition } from './utils/transitionStore';
import { say, sayLocal } from './utils/say';
import { OwnedTiles } from './components/dashboard/OwnedTiles';
import tilesData from './settings/tiles.json';
import { buildTilesFromTemplates, SavedGameState } from './game/TileSet';
import { rehydrateGameState } from './game/rehydrate';
import { isLocalTurn, isLocalHuman } from './game/seats';
import { showHarvestScreen } from './actions/harvest';
import { unitGoldValue } from './game/resources';
import { clearOnlineSession } from './online/onlineStore';
import { useLiveFeed, resetLiveFeed } from './online/liveFeedStore';
import { resetRemoteMove } from './online/remoteMoveStore';
import { hostGame, joinGame } from './online/session';
import { useOnlineSync } from './online/useOnlineSync';
import ShareCodesScreen from './components/menu/ShareCodesScreen';
import TurnWaitShield from './components/board/TurnWaitShield';
import { isMobileLayout } from './components/board/common';
import { CurrentTile } from './components/board/CurrentTile';
import { TurnAnnouncement } from './components/board/TurnAnnouncement';
import { AutoEndTurnNotice } from './components/board/AutoEndTurnNotice';
import { Gold } from './components/snippets/Gold';
import { gameStart } from './actions/gameStart';
import GameMessage from './components/snippets/GameMessage';
import { PlayerSetup } from './utils/playerSetup';
import GameLogModal, { LogMessage } from './components/menu/GameLogModal';
import { gameEvent } from './utils/events';
import { afterMoveLogic } from './actions/afterMoveLogic';
import { ModalRenderer } from './components/screens/ModalRenderer';
import { BotController } from './components/BotController';
import { showDice } from './utils/diceStore';
import { requestShakeToRollPermission } from './utils/useShakeToRoll';
import { resolveAppVersion } from './utils/useAppVersion';
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
import { t } from './i18n';
import { BattleScreen } from './components/screens/BattleScreen';
import NewGameModal from './components/screens/NewGameModal';
import { rollAndMove } from './actions/rollAndMove';
import { DRAGON_GOLD } from './game/constants';
import { STARS_TO_WIN } from './utils/stars';
import { getOverrides } from './utils/overridesStore';
import { getSettings } from './utils/settingsStore';
import { resetEndTurn, setEndTurn } from './utils/endTurnStore';
import { ActionBar } from './components/dashboard/ActionBar';
import { ShieldColumn } from './components/ui/ShieldColumn';
import { YearIndicator } from './components/board/YearIndicator';
import VersionMismatchBanner from './components/board/VersionMismatchBanner';
import FogTransition from './components/screens/FogTransition';
import { ScreenRenderer } from './components/screens/ScreenRenderer';
import { DecoratedButton } from './components/ui/DecoratedButton';
import StatsScreen from './components/menu/StatsScreen';

/** Most recent game-log entries kept (and persisted). A full game produces
 * thousands of messages, which would eventually blow localStorage's quota. */
const MAX_LOG_MESSAGES = 500;

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  // Restored up front (rather than in loadGameData's effect) so no message
  // logged during startup can land before the saved history is in place and
  // get overwritten by it.
  const [gameLog, setGameLog] = useState<LogMessage[]>(() =>
    loadFromStorage<LogMessage[]>('game-log', [])
  );
  const [showLogModal, setShowLogModal] = useState(false);
  const screen = useScreen();
  const liveFeed = useLiveFeed();

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
      // Capped so a long game can't grow the log past what localStorage will
      // hold -- the oldest entries fall off the front.
      setGameLog((prev) => [...prev, detail].slice(-MAX_LOG_MESSAGES));
    };

    // Both names: sayLocal() dispatches its own so the online streamer can
    // ignore it (see utils/say.ts), but it still belongs in the history.
    window.addEventListener('logMessage', handleLogMessage);
    window.addEventListener('logMessageLocal', handleLogMessage);
    return () => {
      window.removeEventListener('logMessage', handleLogMessage);
      window.removeEventListener('logMessageLocal', handleLogMessage);
    };
  }, []);

  // Persisted alongside game-state/game-screen so the history survives a
  // reload; cleared by New Game together with them.
  useEffect(() => {
    if (isHalted()) return;
    saveToStorage('game-log', gameLog);
  }, [gameLog]);

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

      const byId = new Map<string, TileJSON>(freshTemplates.map((t) => [t.id, t]));

      // Rebuild each tile from fresh JSON but carry over runtime state
      const updatedTiles = gs.tiles.map((tile) => {
        const fresh = byId.get(tile.id);
        if (!fresh) return tile;
        return new Tile({
          ...fresh,
          owner: tile.owner,
          level: tile._level,
          garrison: tile.garrison,
          garrisonMilitia: tile.garrisonMilitia,
          garrisonRiders: tile.garrisonRiders,
          baseGarrison: tile.baseGarrison,
          unclaimedSinceTurn: tile.unclaimedSinceTurn,
          razedInRound: tile.razedInRound,
        });
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

      // A join link wins over whatever is in localStorage: the player followed
      // it deliberately, and the server's copy is the shared truth.
      const joinCode = new URLSearchParams(window.location.search).get('code');
      if (joinCode) {
        // Drop the code from the address bar so a later reload doesn't re-join
        // and discard a turn in progress.
        window.history.replaceState({}, '', window.location.pathname);
        void joinGame(joinCode.split(',')).then((board) => {
          if (!board) {
            showScreen({ content: <NewGameModal onStart={handleStartGame} /> });
            return;
          }

          resumeAfterHalt();
          setGameState(board);
          gameEvent('setPhase', board.turnPhase);
          if (isLocalTurn(board)) startLocalTurn(board);
        });
        return;
      }

      const saved = loadFromStorage('game-state', null);
      if (saved) {
        try {
          resolveAppVersion().then((version) =>
            sayLocal(`Dragon's Bounty v.${version}: restoring saved game`, 'info')
          );

          const restored = rehydrateGameState(saved as SavedGameState);

          setGameState(restored);

          // Mid-Harvest: the screen is rebuilt from state, not saved.
          if (restored.harvest) {
            if (restored.activePlayer.isComputer) setEndTurn();
            else if (isLocalHuman(restored.activePlayer)) showHarvestScreen(restored, updateGameState);
            gameEvent('setPhase', restored.turnPhase);
            return;
          }

          const savedScreen = loadFromStorage<SavedScreen | null>('game-screen', null);
          if (savedScreen) {
            switch (savedScreen.type) {
              case 'prison':
                showPrisonScreen(savedScreen.message ?? '');
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
                  caravanDefenceRiders: savedScreen.caravanDefenceRiders,
                  caravanPrize: savedScreen.caravanPrize,
                  message: savedScreen.message,
                  buttons: [
                    {
                      label: '⚔️ Attack!',
                      onClick: () =>
                        showScreen({
                          screenType: 'caravan-battle',
                          caravanDefence: savedScreen.caravanDefence,
                  caravanDefenceRiders: savedScreen.caravanDefenceRiders,
                          caravanPrize: savedScreen.caravanPrize,
                          content: (
                            <BattleScreen
                              mode="caravan"
                              attacker={restored.activePlayer}
                              gameState={restored}
                              updateGameState={updateGameState}
                              caravanDefence={savedScreen.caravanDefence!}
                              caravanDefenceRiders={savedScreen.caravanDefenceRiders}
                              caravanPrize={savedScreen.caravanPrize!}
                              onClose={() => gameEvent('showDice', null)}
                            />
                          ),
                        }),
                    },
                    {
                      label: '🕊️ Let it pass',
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
                  caravanDefenceRiders: savedScreen.caravanDefenceRiders,
                  caravanPrize: savedScreen.caravanPrize,
                  content: (
                    <BattleScreen
                      mode="caravan"
                      attacker={restored.activePlayer}
                      gameState={restored}
                      updateGameState={updateGameState}
                      caravanDefence={savedScreen.caravanDefence!}
                              caravanDefenceRiders={savedScreen.caravanDefenceRiders}
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
              case 'tile-battle': {
                // No extra identifiers needed -- the tile being fought over
                // is always whichever one the active player is standing on,
                // already implied by their (persisted) position.
                const tile = restored.activeTile;
                const defender = tile.owner
                  ? restored.players.find((p) => p.id === tile.owner)
                  : undefined;
                showScreen({
                  screenType: 'tile-battle',
                  content: (
                    <BattleScreen
                      attacker={restored.activePlayer}
                      defender={defender}
                      tile={tile}
                      gameState={restored}
                      updateGameState={updateGameState}
                    />
                  ),
                });
                break;
              }

              case 'player-battle': {
                const opponent = restored.players.find((p) => p.id === savedScreen.defenderId);
                if (opponent) {
                  showScreen({
                    screenType: 'player-battle',
                    defenderId: opponent.id,
                    battlefieldUnits: savedScreen.battlefieldUnits,
                    content: (
                      <BattleScreen
                        mode="player"
                        attacker={restored.activePlayer}
                        defender={opponent}
                        battlefieldUnits={savedScreen.battlefieldUnits ?? 0}
                        gameState={restored}
                        updateGameState={updateGameState}
                        onClose={() => gameEvent('showDice', null)}
                      />
                    ),
                  });
                }

                break;
              }

              case 'ambush-battle':
                showScreen({
                  screenType: 'ambush-battle',
                  ambushAttackerUnits: savedScreen.ambushAttackerUnits,
                  ambushAttackerRiders: savedScreen.ambushAttackerRiders,
                  content: (
                    <BattleScreen
                      mode="ambush"
                      attacker={restored.activePlayer}
                      ambushAttackerUnits={savedScreen.ambushAttackerUnits ?? 1}
                      ambushAttackerRiders={savedScreen.ambushAttackerRiders}
                      gameState={restored}
                      updateGameState={updateGameState}
                      onClose={() => gameEvent('showDice', null)}
                    />
                  ),
                });
                break;
              case 'rogue-attack': {
                const tile = restored.tiles[savedScreen.tileIndex ?? -1];
                const defender = tile
                  ? restored.players.find((p) => p.id === tile.owner)
                  : undefined;
                if (tile && defender) {
                  const horde = new Player({
                    name: t('rogueAttack.horde'),
                    color: '#8b5a2b',
                    gold: 0,
                    units: savedScreen.hordeUnits ?? 1,
                    position: -1,
                    image: 'black',
                    isComputer: true,
                  });
                  showScreen({
                    screenType: 'rogue-attack',
                    tileIndex: savedScreen.tileIndex,
                    hordeUnits: savedScreen.hordeUnits,
                    content: (
                      <BattleScreen
                        mode="rogue"
                        attacker={horde}
                        defender={defender}
                        tile={tile}
                        gameState={restored}
                        updateGameState={updateGameState}
                        onClose={() => gameEvent('showDice', null)}
                      />
                    ),
                  });
                }

                break;
              }

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
                      label: t('tavern.newFolksWelcome'),
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
                      label: '🪎 My precious!',
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

          return;
        } catch (e) {
          console.error('Failed to restore saved game, starting fresh:', e);
          removeFromStorage('game-state');
          removeFromStorage('game-log');
          setGameLog([]);
        }
      }

      showScreen({ content: <NewGameModal onStart={handleStartGame} /> });
    }

    loadGameData();
  }, []);

  useEffect(() => {
    if (!gameState) return;
    // A halted session is being torn down -- persisting here would write the
    // old game back over the removal that New Game just did, and the reload
    // would restore it (bots and all).
    if (isHalted()) return;
    saveToStorage('game-state', gameState);
    if (screen?.screenType && !screen?.doNotPersist) {
      saveToStorage<SavedScreen>('game-screen', {
        type: screen.screenType,
        message: screen.message,
        htmlMessage: screen.htmlMessage,
        title: screen.title,
        caravanDefence: screen.caravanDefence,
        caravanDefenceRiders: screen.caravanDefenceRiders,
        caravanPrize: screen.caravanPrize,
        tileIndex: screen.tileIndex,
        defenderId: screen.defenderId,
        battlefieldUnits: screen.battlefieldUnits,
        ambushAttackerUnits: screen.ambushAttackerUnits,
        ambushAttackerRiders: screen.ambushAttackerRiders,
        hordeUnits: screen.hordeUnits,
      });
    } else {
      removeFromStorage('game-screen');
    }
  }, [gameState, screen]);

  /** Open the dice — but only for a seat this browser plays. playerOrder is
   * shuffled at creation, so hosting a game does not mean going first. */
  const startLocalTurn = useCallback(
    (board: GameState) => {
      if (!isLocalTurn(board)) return;
      showDice(handleDiceRollAndMove);
    },
    [handleDiceRollAndMove]
  );

  const handleStartGame = useCallback(
    (playersSetup: PlayerSetup[], online?: boolean) => {
      const tiles = buildTilesFromTemplates(tilesData as TileJSON[]);
      // "Fog of war" setting: reveal every tile from the start instead of
      // the default, where each is hidden until a player lands on it.
      if (getSettings().disableFogOfWar) {
        tiles.forEach((tile) => {
          tile.fog = false;
        });
      }

      const players = playersSetup.map((p, i) => {
        const name =
          p.isComputer && p.character ? `${p.name} ${CHARACTER_EMOJI[p.character]}` : p.name;
        return new Player({ ...p, name, id: i + 1 });
      });
      const initialGameState = new GameState(tiles, players);
      // Fresh session -- let loops run again (New Game halts them first).
      resumeAfterHalt();
      gameStart(initialGameState, updateGameState);

      // "Start Game" is a real user gesture, which iOS requires before it
      // will grant devicemotion access for shake-to-roll.
      requestShakeToRollPermission();

      clearScreen();
      gameEvent('setPhase', initialGameState.turnPhase);
      sayLocal(`${initialGameState.activePlayer.name}, start the game by rolling the dice!`, 'info');

      if (online) {
        // The creating client's board is canonical: both the tile layout and
        // the turn order are randomised here, so it has to be uploaded before
        // anyone can join.
        void hostGame(initialGameState).then((codes) => {
          if (codes) {
            showScreen({
              content: <ShareCodesScreen gameState={initialGameState} />,
              doNotPersist: true,
            });
          }

          startLocalTurn(initialGameState);
        });
        return;
      }

      showDice(handleDiceRollAndMove);
    },
    [updateGameState, startLocalTurn, handleDiceRollAndMove]
  );

  useOnlineSync({
    gameState,
    setGameState,
    setGameLog,
    updateGameState,
    startLocalTurn,
  });

  const handleOpenLog = () => setShowLogModal(true);
  const handleCloseLog = () => setShowLogModal(false);

  return (
    <div className="App">
      <VersionMismatchBanner />
      <FogTransition />

      <ToastContainer
        position={isMobileLayout() ? 'top-center' : 'top-right'}
        autoClose={3500}
        hideProgressBar={true}
        closeOnClick={true}
      />

      <ModalRenderer />

      {!gameState && screen?.content && <>{screen.content}</>}

      {gameState?.gameOver &&
        (() => {
          // A save from before stars existed has no winCondition at all --
          // that can only mean a Dragon win, since it was the only way to
          // end the game then. Same reasoning for falling back to
          // activePlayer: the Dragon's winner always IS whoever's turn it
          // was when they landed the killing blow, but a star's winner is
          // the tile owner who took the prisoner, not necessarily them.
          const winner = gameState.players.find((p) => p.id === gameState.winner) ?? gameState.activePlayer;
          const isDragonWin = (gameState.winCondition ?? 'dragon') === 'dragon';
          const tilesGold = winner.ownedTiles.reduce((sum, idx) => {
            const t = gameState.tiles[idx];
            return t && t.owner === winner.id ? sum + t.currentPrice.gold : sum;
          }, 0);
          const armyGold = winner.militia * unitGoldValue('militia') + winner.riders * unitGoldValue('riders');
          // The Dragon's hoard is part of the victory tally only when it's
          // actually the thing that was won -- a stars win never saw it.
          const totalGold = winner.gold + tilesGold + armyGold + (isDragonWin ? DRAGON_GOLD : 0);
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
                  fontFamily: 'HeroesTextured',
                }}
              >
                {isDragonWin ? (
                  <>
                    Oh mighty <PlayerLabel player={winner} />,<br />
                    it took you {years} years to slain that dragon!
                    <br />
                    <i style={{ fontSize: '0.8rem', fontFamily: 'HeroesTextured' }}>
                      Boromir would do it in only {years - 1}...
                    </i>
                  </>
                ) : (
                  <>
                    Oh mighty <PlayerLabel player={winner} />,<br />
                    {STARS_TO_WIN} prisoners of war taken in {years} years have won you the realm!
                  </>
                )}
                <br />
                <br />
                You leave that kingdom <br />
                with a fame of {winner.fame}🏆 and <Gold amount={totalGold.toLocaleString()} />
                <br />
                <br />
                Congratulations! Time for a new challenge!
              </div>
              <div
                style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}
              >
                <DecoratedButton
                  onClick={() => showScreen({ content: <StatsScreen gameState={gameState} /> })}
                >
                  Player Stats 📈
                </DecoratedButton>
                <DecoratedButton
                  onClick={() => {
                    halt();
      resetFogTransition();
                    removeFromStorage('game-state');
                    removeFromStorage('game-screen');
                    removeFromStorage('game-log');
                    // Or the next game silently inherits this game's join code.
                    clearOnlineSession();
                    resetLiveFeed();
                    resetRemoteMove();
                    setGameState(null);
                    setGameLog([]);
                    showScreen({ content: <NewGameModal onStart={handleStartGame} /> });
                  }}
                >
                  New Game
                </DecoratedButton>
              </div>
            </div>
          );
        })()}

      {gameState && (
        <BotController gameState={gameState} updateGameState={updateGameState} />
      )}

      {gameState && (
        <div id="mainContainer">
          <TurnWaitShield gameState={gameState} />
          <TurnAnnouncement gameState={gameState} />
          <AutoEndTurnNotice gameState={gameState} updateGameState={updateGameState} />

          <ShieldColumn
            gameState={gameState}
            updateGameState={updateGameState}
            onOpenLog={handleOpenLog}
          />

          <ScreenRenderer gameState={gameState} updateGameState={updateGameState} />

          <div className="board-section">
            {/* liveBanner mirrors whoever is on turn, so an observer sees
                their banner change as it happens; it retires once the state
                carrying it has been applied (online/liveFeedStore.ts). */}
            {!screen && <GameMessage message={liveFeed.banner ?? gameState.gameMessage} />}
            <CurrentTile gameState={gameState} updateGameState={updateGameState} />
            <CurrentPlayerCard gameState={gameState} />
            <BoardCanvas board={gameState} updateGameState={updateGameState} />
            <YearIndicator gameState={gameState} />
          </div>

          <div className="side-pane">
            <ActionBar gameState={gameState} updateGameState={updateGameState} />

            {showLogModal && <GameLogModal messages={gameLog} onClose={handleCloseLog} />}

            <OwnedTiles gameState={gameState} updateGameState={updateGameState} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
