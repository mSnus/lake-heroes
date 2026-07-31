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
import { LANGUAGES, cycleLanguage, useLanguage, t } from '../i18n';

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

  // Covers movement rolls and the Tavern/Sphynx/Treasure dice prompts, since
  // they all funnel through the same diceStore (active && !rolling). Disabled
  // during a bot's turn — BotController already rolls for it automatically.
  useShakeToRoll(diceActive && !rolling && !isBotTurn, startDiceRoll);

  function handleNewGame() {
    setMenuOpen(false);
    if (window.confirm(t('shieldColumn.confirmNewGame'))) {
      try {
        localStorage.removeItem('game-state');
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
        <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 8, justifyContent: 'flex-end' }}>
          <div className="shield-button-container" title={t('shieldColumn.menu')}>
            <button onClick={() => setMenuOpen((o) => !o)} className="shield-button">
              🐲
            </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 8 }}>
            {/* Right column: primary actions, under the 🐲 toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="shield-button-container" title={t('shieldColumn.newGame')}>
                <button onClick={handleNewGame} className="shield-button">
                  🏆
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.help')}>
                <button
                  onClick={() => { setMenuOpen(false); showScreen({ content: <HelpScreen /> }); }}
                  className="shield-button"
                >
                  ?
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.gameLog')}>
                <button onClick={() => { setMenuOpen(false); onOpenLog(); }} className="shield-button">
                  📜
                </button>
              </div>
            </div>

            {/* Left column: language, reload, cheat */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="shield-button-container" title={t('common.language')}>
                <button onClick={cycleLanguage} className="shield-button">
                  {currentFlag}
                </button>
              </div>
              <div className="shield-button-container" title={t('shieldColumn.reload')}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigator.serviceWorker?.getRegistrations().then((regs) =>
                      Promise.all(regs.map((r) => r.update()))
                    ).finally(() => window.location.reload());
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
                    showScreen({ content: <CheatScreen gameState={gameState} updateGameState={updateGameState} /> });
                  }}
                  className="shield-button"
                >
                  👻
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
          <div style={{ ...colStyle, bottom: '60px' }}>
            {diceActive && (
              <div className="shield-button-container main-button" title={t('shieldColumn.rollDice')}>
                <button onClick={startDiceRoll} className="shield-button">
                  🎲
                </button>
              </div>
            )}
            {canEndTurn && (
              <div className="shield-button-container main-button" title={t('shieldColumn.endTurn')}>
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
