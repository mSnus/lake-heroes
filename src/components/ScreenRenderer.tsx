import React from 'react';
import { GameState } from '../game/GameState';
import { useScreen } from '../utils/screenStore';
import { SPRITE_PX, SPRITE_INTERVAL, SPRITE_CROP, SPRITE_COLS, SPRITE_ROWS } from '../game/constants';
import { afterMoveLogic } from '../actions/afterMoveLogic';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { OwnedTiles } from './OwnedTiles';
import { gameEvent } from '../utils/events';

interface ScreenRendererProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

export const ScreenRenderer: React.FC<ScreenRendererProps> = ({
  gameState,
  updateGameState,
}) => {
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
    try { onClick(); } catch {}
  }

  return (
    <>
      <ScreenBackground image={config.background!}>
        {config.fade && <Fade />}
        {config.title && <div className="text-title">{config.title.trim()}</div>}
        {config.sprite && (() => {
          const EFFECTIVE = SPRITE_PX - 2 * SPRITE_CROP;
          const SHEET_W = (SPRITE_PX + SPRITE_INTERVAL) * SPRITE_COLS;
          const SHEET_H = (SPRITE_PX + SPRITE_INTERVAL) * SPRITE_ROWS;
          const ox = config.sprite.x * (SPRITE_PX + SPRITE_INTERVAL) + SPRITE_CROP;
          const oy = config.sprite.y * (SPRITE_PX + SPRITE_INTERVAL) + SPRITE_CROP;
          return (
            <div
              style={{
                width: '30vw',
                height: '30vw',
                borderRadius: '50%',
                backgroundImage: `url(assets/sprites3i.png)`,
                backgroundSize: `calc(30vw * ${SHEET_W} / ${EFFECTIVE}) calc(30vw * ${SHEET_H} / ${EFFECTIVE})`,
                backgroundPositionX: `calc(30vw * ${-ox} / ${EFFECTIVE})`,
                backgroundPositionY: `calc(30vw * ${-oy} / ${EFFECTIVE})`,
                marginBottom: '16px',
                flexShrink: 0,
                zIndex: 6000,
              }}
            />
          );
        })()}
        {config.encounter && (
          <div className="text-message">
            <strong style={{ color: config.encounter.playerColor }}>
              {config.encounter.playerName}
            </strong>
            <br />
            encounters <strong>{config.encounter.tileName}</strong>
            {config.encounter.ownerName && (
              <>
                <br />
                that belongs to{' '}
                <strong style={{ color: config.encounter.ownerColor }}>
                  {config.encounter.ownerName}
                </strong>
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
          <div
            className="text-message"
            dangerouslySetInnerHTML={{ __html: config.htmlMessage }}
          />
        )}
      </ScreenBackground>
      {!config.sellMode && (
        <div className="game-menu" style={{ top: '80vh' }}>
          {config.encounter?.gold !== undefined && (
            <div className="player-stats-savings" style={{ justifyContent: 'center', marginBottom: '8px', color: config.encounter.playerColor }}>
              <span>👛</span>
              <strong>{config.encounter.gold} 🟡</strong>
              <strong>{config.encounter.units} 🧍</strong>
            </div>
          )}
          <div>
            {buttons.map((btn, i) => (
              <button key={i} className="game-menu-button" disabled={btn.disabled} onClick={() => handleButtonClick(btn.onClick, btn.action)}>
                {btn.label}
              </button>
            ))}
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
