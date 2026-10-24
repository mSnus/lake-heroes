import { isLocalHuman } from '../../game/seats';
import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../../game/GameState';
import { endTurn } from '../../actions/endTurn';
import { gameEvent } from '../../utils/events';
import { useModal, startDiceRoll } from '../../utils/diceStore';
import { useEndTurnReady } from '../../utils/endTurnStore';
import { showScreen } from '../../utils/screenStore';
import { useShakeToRoll } from '../../utils/useShakeToRoll';
import HelpScreen from '../screens/HelpScreen';
import CheatScreen from '../godmode/CheatScreen';
import OverridesScreen from '../godmode/OverridesScreen';
import SettingsScreen from '../menu/SettingsScreen';
import StatsScreen from '../menu/StatsScreen';
import BattleSimScreen from '../godmode/BattleSimScreen';
import EconomySimScreen from '../godmode/EconomySimScreen';
import { halt } from '../../utils/haltStore';
import { resetFogTransition } from '../../utils/transitionStore';
import { forceFreshReload } from '../../utils/forceReload';
import { resetOverrides } from '../../utils/overridesStore';
import { clearOnlineSession, isOnlineGame } from '../../online/onlineStore';
import { resetLiveFeed } from '../../online/liveFeedStore';
import { resetRemoteMove } from '../../online/remoteMoveStore';
import ShareCodesScreen from '../menu/ShareCodesScreen';
import { useMapEditStore, enableMapEditMode, disableMapEditMode } from '../../utils/mapEditStore';
import { t } from '../../i18n';
import { isMobileLayout } from '../board/common';
import { removeFromStorage } from '../../utils/storage';
import SaveSlotsScreen from '../menu/SaveSlotsScreen';
import { openEruda } from '../../utils/eruda';

interface ShieldColumnProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
  onOpenLog: () => void;
}

export const ShieldColumn: React.FC<ShieldColumnProps> = ({
  gameState,
  updateGameState,
  onOpenLog,
}) => {
  const { active: diceActive, rolling } = useModal();
  const endTurnReady = useEndTurnReady();
  const canEndTurn = endTurnReady && !diceActive;
  // Covers a remote human's turn as well as a bot's -- both mean "this
  // browser offers no roll/end-turn controls". Offline this is !isComputer.
  const isBotTurn = !isLocalHuman(gameState.activePlayer);
  const [menuOpen, setMenuOpen] = useState(false);
  // The godmode column (♻️ reload through 🗺️ Map Editor) only shows up when
  // the 🐲 button is double-tapped to open the menu -- a single tap still
  // opens the regular menu, godmode column just stays out of it. Closing is
  // always a single tap either way, so this resets alongside menuOpen
  // wherever that's closed (closeMenu below).
  const [godmodeVisible, setGodmodeVisible] = useState(false);
  // Pending "was this a single tap?" timer -- a tap on the closed menu waits
  // this long for a second tap before committing to opening single-tap-style
  // (no godmode). A second tap arriving first cancels it and opens
  // immediately with godmode shown instead.
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_TAP_MS = 300;

  useEffect(
    () => () => {
      if (pendingTapRef.current) clearTimeout(pendingTapRef.current);
    },
    []
  );

  function closeMenu() {
    if (pendingTapRef.current) {
      clearTimeout(pendingTapRef.current);
      pendingTapRef.current = null;
    }

    setMenuOpen(false);
    setGodmodeVisible(false);
  }

  function handleMenuButtonClick() {
    // Open menus close in a single tap regardless of how they were opened.
    if (menuOpen) {
      closeMenu();
      return;
    }

    if (pendingTapRef.current) {
      // Second tap within the window -- open now, with godmode.
      clearTimeout(pendingTapRef.current);
      pendingTapRef.current = null;
      setMenuOpen(true);
      setGodmodeVisible(true);
      return;
    }

    // First tap -- wait briefly for a possible second one.
    pendingTapRef.current = setTimeout(() => {
      pendingTapRef.current = null;
      setMenuOpen(true);
      setGodmodeVisible(false);
    }, DOUBLE_TAP_MS);
  }

  const mapEdit = useMapEditStore();

  // Covers movement rolls and the Tavern/Sphynx/Treasure dice prompts, since
  // they all funnel through the same diceStore (active && !rolling). Disabled
  // during a bot's turn — BotController already rolls for it automatically.
  useShakeToRoll(diceActive && !rolling && !isBotTurn, startDiceRoll);

  function handleNewGame() {
    closeMenu();
    if (window.confirm(t('shieldColumn.confirmNewGame'))) {
      // Halt first: reload is asynchronous, and bot timers queued while the
      // confirm dialog blocked would otherwise fire, re-persist the old game
      // over the removal below, and have it restored after the reload.
      halt();
      resetFogTransition();
      try {
        removeFromStorage('game-state');
        removeFromStorage('game-screen');
        removeFromStorage('game-log');
        // Cheated parameters shouldn't leak into a fresh game.
        resetOverrides();
        // Or the next game silently inherits this game's join code.
        clearOnlineSession();
        resetLiveFeed();
        resetRemoteMove();
      } catch {
        // ignore
      } finally {
        window.location.reload();
      }
    }
  }

  function handleEndTurn() {
    if (!canEndTurn) return;
    gameEvent('setPhase', 'before-move');
    gameEvent('displayTile', {});
    endTurn(gameState, updateGameState);
  }

  const colStyle: React.CSSProperties = {
    position: 'absolute',
    right: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 1010,
  };

  return (
    <>
      <div style={{ ...colStyle, top: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <div className="shield-button-container main-menu-button" title={t('shieldColumn.menu')}>
            <button onClick={handleMenuButtonClick} className="shield-button">
              🐲
            </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            {/* Right column: primary actions, under the 🐲 toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="shield-button-container" title={t('shieldColumn.newGame')}>
                <button onClick={handleNewGame} className="shield-button">
                  🏆
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.help')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({ content: <HelpScreen /> });
                  }}
                  className="shield-button"
                >
                  ?
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.gameLog')}>
                <button
                  onClick={() => {
                    closeMenu();
                    onOpenLog();
                  }}
                  className="shield-button"
                >
                  📜
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.statistics')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({ content: <StatsScreen gameState={gameState} /> });
                  }}
                  className="shield-button"
                >
                  📈
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.saveSlots')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({ content: <SaveSlotsScreen />, doNotPersist: true });
                  }}
                  className="shield-button"
                >
                  💾
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.settings')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({ content: <SettingsScreen /> });
                  }}
                  className="shield-button"
                >
                  ⚙️
                </button>
              </div>
              {/* Join links -- only meaningful in a network game, so it is
                  absent entirely from a local one rather than disabled. */}
              {isOnlineGame() && (
                <div className="shield-button-container" title={t('online.shareTitle')}>
                  <button
                    onClick={() => {
                      closeMenu();
                      showScreen({
                        content: <ShareCodesScreen gameState={gameState} />,
                        doNotPersist: true,
                      });
                    }}
                    className="shield-button"
                  >
                    🔗
                  </button>
                </div>
              )}
            </div>

            {/* Left (godmode) column: reload, cheat, overrides, sims, map
                edit -- only shown when the 🐲 button was double-tapped to
                open the menu (see handleMenuButtonClick). */}
            {godmodeVisible && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="shield-button-container" title={t('shieldColumn.reload')}>
                <button
                  onClick={() => {
                    closeMenu();
                    forceFreshReload();
                  }}
                  className="shield-button"
                >
                  ♻️
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.cheat')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({
                      content: (
                        <CheatScreen gameState={gameState} updateGameState={updateGameState} />
                      ),
                    });
                  }}
                  className="shield-button"
                >
                  👻
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.overrides')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({
                      content: (
                        <OverridesScreen gameState={gameState} updateGameState={updateGameState} />
                      ),
                    });
                  }}
                  className="shield-button"
                >
                  ⚖️
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.battleSim')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({ content: <BattleSimScreen /> });
                  }}
                  className="shield-button"
                >
                  🤼
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.economySim')}>
                <button
                  onClick={() => {
                    closeMenu();
                    showScreen({ content: <EconomySimScreen /> });
                  }}
                  className="shield-button"
                >
                  📊
                </button>
              </div>
              <div
                className="shield-button-container"
                title={mapEdit.active ? t('shieldColumn.mapEditOn') : t('shieldColumn.mapEditOff')}
              >
                <button
                  onClick={() => {
                    closeMenu();
                    if (mapEdit.active) disableMapEditMode();
                    else enableMapEditMode();
                  }}
                  className="shield-button"
                  style={mapEdit.active ? { filter: 'drop-shadow(0 0 6px #ffe066)' } : undefined}
                >
                  🗺️
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.eruda')}>
                <button
                  onClick={() => {
                    closeMenu();
                    openEruda();
                  }}
                  className="shield-button"
                >
                  🐛
                </button>
              </div>
            </div>
            )}
          </div>
        )}
      </div>

      {isBotTurn ? (
        <div style={{ ...colStyle, bottom: '60px' }}>
          <div
            className="main-button"
            title={t('shieldColumn.aiTurn')}
            style={{
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17.6px',
            }}
          >
            🤖
          </div>
        </div>
      ) : (
        (diceActive || canEndTurn) && (
          <div style={{
              ...colStyle,
              top: isMobileLayout() ? 'calc(100vw * 5 / 4 - 25px)' : '8px' ,
              right: isMobileLayout() ? '8px' : 'unset' ,
              left: isMobileLayout() ? 'unset' : 'calc(100vh * var(--board-aspect-ratio) - 20px)' ,
            }}>
            {diceActive && (
              <div
                className="main-button-container"
                id="rollDiceButton"
                title={t('shieldColumn.rollDice')}
                style={{ filter: `drop-shadow(0 0 5px ${gameState.activePlayer?.color ?? '#000'})` }}
              >
                <button onClick={startDiceRoll} className="shield-button">
                  🎲
                </button>
              </div>
            )}
            {canEndTurn && (
              <div
                className="main-button-container"
                id="endTurnButton"
                title={t('shieldColumn.endTurn')}
                style={{ filter: `drop-shadow(0 0 5px ${gameState.activePlayer?.color ?? '#000'})` }}
              >
                <button onClick={handleEndTurn} className="shield-button">
                  ⏳
                </button>
              </div>
            )}
          </div>
        )
      )}
    </>
  );
};
