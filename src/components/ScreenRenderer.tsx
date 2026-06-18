import React from 'react';
import { GameState } from '../game/GameState';
import { useScreen } from '../utils/screenStore';
import { afterMoveLogic } from '../actions/afterMoveLogic';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { OwnedTiles } from './OwnedTiles';
import { DecoratedButton } from './DecoratedButton';
import { PlayerLabel } from './PlayerLabel';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { gameEvent } from '../utils/events';

interface ScreenRendererProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

export const ScreenRenderer: React.FC<ScreenRendererProps> = ({ gameState, updateGameState }) => {
  const config = useScreen();
  if (!config) return null;

  if (config.content) return <>{config.content}</>;

  const sellAndRecheck = (gs: GameState) => {
    updateGameState(gs);
    afterMoveLogic(gs, updateGameState);
  };

  const buttons = config.buttons ?? [];

  function handleButtonClick(onClick: () => void, action?: string) {
    if (action === 'end-turn') gameEvent('setPhase', 'before-move');
    try {
      onClick();
    } catch {}
  }

  return (
    <>
      <ScreenBackground image={config.background!}>
        {config.fade && <Fade />}
        {config.title && <div className="text-title">{config.title.trim()}</div>}
        {config.spriteImage && <SpriteCircleIcon src={config.spriteImage} />}
        {config.encounter && (
          <div className="text-message">
            <PlayerLabel name={config.encounter.playerName} color={config.encounter.playerColor} bold />

            {config.encounter?.gold !== undefined && (
              <div
                className="player-stats-savings"
                style={{
                  justifyContent: 'center',
                  marginBottom: '8px',
                  color: config.encounter.playerColor,
                }}
              >
                <strong>{config.encounter.gold} 🟡</strong>
                &nbsp;
                <strong>{config.encounter.units} 🧍</strong>
              </div>
            )}
            encounters <strong>{config.encounter.tileName}</strong>
            {config.encounter.tileDefence !== undefined && <> 🛡️ {config.encounter.tileDefence}</>}
            {config.encounter.ownerName && (
              <>
                <br />
                that belongs to{' '}
                <PlayerLabel name={config.encounter.ownerName} color={config.encounter.ownerColor} bold />
                {config.encounter.canFight && config.encounter.tileDefence !== undefined && (
                  <>
                    <br />
                    Risk {config.encounter.tileDefence}🧍 to raze it or pay {config.encounter.tileFee}🟡 and go?
                  </>
                )}
              </>
            )}
            {config.encounter.outcomeText && (
              <>
                <br />
                <br />
                <span style={{ fontSize: '1rem', opacity: 0.85, whiteSpace: 'pre-line' }}>
                  {config.encounter.outcomeText}
                </span>
              </>
            )}
            {config.encounter.subMessage && (
              <>
                <br />
                <br />
                <span style={{ fontSize: '1rem', opacity: 0.9 }}>
                  {config.encounter.subMessage}
                </span>
              </>
            )}
          </div>
        )}
        {config.message && <div className="text-message">{config.message}</div>}
        {config.htmlMessage && (
          <div className="text-message" dangerouslySetInnerHTML={{ __html: config.htmlMessage }} />
        )}
      </ScreenBackground>
      {!config.sellMode && (
        <div className="game-menu" style={{ top: '80vh' }}>
          <div>
            {buttons.map((btn, i) =>
              buttons.length === 1 ? (
                <DecoratedButton
                  key={i}
                  disabled={btn.disabled}
                  onClick={() => handleButtonClick(btn.onClick, btn.action)}
                >
                  {btn.label}
                </DecoratedButton>
              ) : (
                <button
                  key={i}
                  className="game-menu-button"
                  disabled={btn.disabled}
                  onClick={() => handleButtonClick(btn.onClick, btn.action)}
                >
                  {btn.label}
                </button>
              )
            )}
          </div>
        </div>
      )}
      {config.sellMode && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 6000,
            background: 'rgba(0,0,0,0.75)',
            padding: '8px',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: '1rem',
              textAlign: 'center',
              padding: '6px 12px 8px',
              textShadow: '1px 1px 4px black',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {config.sellHeader && <span>{config.sellHeader}</span>}
            {(config.buttons ?? []).map((btn, i) => (
              <button
                key={i}
                className="game-menu-button"
                disabled={btn.disabled}
                onClick={btn.onClick}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <OwnedTiles gameState={gameState} updateGameState={sellAndRecheck} />
        </div>
      )}
    </>
  );
};
