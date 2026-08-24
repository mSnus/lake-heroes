import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { showScreen } from '../utils/screenStore';
import { useShakeToRoll } from '../utils/useShakeToRoll';
import HelpScreen from './HelpScreen';
import CheatScreen from './CheatScreen';
import OverridesScreen from './OverridesScreen';
import StatsScreen from './StatsScreen';
import BattleSimScreen from './BattleSimScreen';
import EconomySimScreen from './EconomySimScreen';
import { halt } from '../utils/haltStore';
import { resetOverrides } from '../utils/overridesStore';
import { useMapEditStore, enableMapEditMode, disableMapEditMode } from '../utils/mapEditStore';
import { LANGUAGES, cycleLanguage, useLanguage, t } from '../i18n';
import { isMobileLayout } from './board/common';

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
  const isBotTurn = gameState.activePlayer.isComputer;
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLanguage = useLanguage();
  const currentFlag = LANGUAGES.find((l) => l.code === currentLanguage)?.flag ?? '🏳️';
  const mapEdit = useMapEditStore();

  // Covers movement rolls and the Tavern/Sphynx/Treasure dice prompts, since
  // they all funnel through the same diceStore (active && !rolling). Disabled
  // during a bot's turn — BotController already rolls for it automatically.
  useShakeToRoll(diceActive && !rolling && !isBotTurn, startDiceRoll);

  function handleNewGame() {
    setMenuOpen(false);
    if (window.confirm(t('shieldColumn.confirmNewGame'))) {
      // Halt first: reload is asynchronous, and bot timers queued while the
      // confirm dialog blocked would otherwise fire, re-persist the old game
      // over the removal below, and have it restored after the reload.
      halt();
      try {
        localStorage.removeItem('game-state');
        localStorage.removeItem('game-screen');
        // Cheated parameters shouldn't leak into a fresh game.
        resetOverrides();
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
            <button onClick={() => setMenuOpen((o) => !o)} className="shield-button">
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
                    setMenuOpen(false);
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
                    setMenuOpen(false);
                    onOpenLog();
                  }}
                  className="shield-button"
                >
                  📜
                </button>
              </div>
              <div className="shield-button-container" title={t('common.language')}>
                <button onClick={cycleLanguage} className="shield-button">
                  {currentFlag}
                </button>
              </div>
            </div>

            {/* Left column: reload, cheat, statistics, map edit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="shield-button-container" title={t('shieldColumn.reload')}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigator.serviceWorker
                      ?.getRegistrations()
                      .then((regs) => Promise.all(regs.map((r) => r.update())))
                      .finally(() => window.location.reload());
                  }}
                  className="shield-button"
                >
                  ♻️
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.cheat')}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
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
                    setMenuOpen(false);
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
              <div className="shield-button-container" title={t('shieldColumn.statistics')}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    showScreen({ content: <StatsScreen gameState={gameState} /> });
                  }}
                  className="shield-button"
                >
                  📈
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.battleSim')}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
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
                    setMenuOpen(false);
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
                    setMenuOpen(false);
                    if (mapEdit.active) disableMapEditMode();
                    else enableMapEditMode();
                  }}
                  className="shield-button"
                  style={mapEdit.active ? { filter: 'drop-shadow(0 0 6px #ffe066)' } : undefined}
                >
                  🗺️
                </button>
              </div>
            </div>
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
