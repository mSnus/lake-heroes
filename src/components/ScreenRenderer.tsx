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
import { formatArmy } from '../utils/formatArmy';
import { useT } from '../i18n';

interface ScreenRendererProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

export const ScreenRenderer: React.FC<ScreenRendererProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const config = useScreen();
  if (!config) return null;

  // King's Castle, the Tavern's recruiting screen, and the guards/fee
  // encounter are pure bookkeeping for a bot — it drives them headlessly
  // (KingsCastleModal/TavernModal's self-driving effect / BotController), so
  // hide just these rather than flashing them at a human who has nothing to
  // do this turn. Other screens stay visible.
  const isSelfDrivingModal = config.screenType === 'kings-castle' || config.screenType === 'tavern-result';
  const isGuardsFee = !!config.encounter && config.encounter.canFight !== undefined;
  const hideForBot = gameState.activePlayer.isComputer && (isSelfDrivingModal || isGuardsFee);
  const hiddenStyle: React.CSSProperties | undefined = hideForBot
    ? { opacity: 0, pointerEvents: 'none' }
    : undefined;

  if (config.content) {
    return isSelfDrivingModal ? <div style={hiddenStyle}>{config.content}</div> : <>{config.content}</>;
  }

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
    <div style={hiddenStyle}>
      <ScreenBackground
        image={config.background!}
        style={config.screenType === 'ambush' ? { paddingTop: '6rem' } : undefined}
      >
        {config.fade && <Fade />}
        {config.title && <div className="text-title">{config.title.trim()}</div>}
        {config.spriteImage && <SpriteCircleIcon src={config.spriteImage} />}
        {config.encounter && (
          <div className="text-message">
            <PlayerLabel
              name={config.encounter.playerName}
              color={config.encounter.playerColor}
              bold
            />{' '}
            {config.encounter?.gold !== undefined && (
              <>
                <strong>{config.encounter.gold}🟡</strong>
                <br />
                <strong>{formatArmy(config.encounter.militia ?? 0, config.encounter.riders ?? 0)}</strong>
              </>
            )}
            <br />
            {t('screenRenderer.encounters')}{' '}
            <strong style={{ color: config.encounter.tile?.groupTextColor }}>
              {config.encounter.tile?.name}
            </strong>
            {config.encounter.tile && <> 🛡️ {config.encounter.tile.defence}</>}
            {config.encounter.ownerName && (
              <>
                <br />
                {t('screenRenderer.belongsTo')}{' '}
                <PlayerLabel
                  name={config.encounter.ownerName}
                  color={config.encounter.ownerColor}
                  bold
                />
                {config.encounter.canFight && config.encounter.tile && (
                  <>
                    <br />
                    <br />
                    {t('screenRenderer.riskOrPay')}
                    <br />
                    <span style={{ fontSize: '1rem', opacity: 0.85 }}>
                      {t('screenRenderer.razedSmokeCaveat')}
                    </span>
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
              // Only the primary pay/fight actions get the big decorated
              // treatment — secondary options (sell tiles, accept loss) stay
              // as plain menu buttons so the screen isn't a wall of them.
              buttons.length === 1 ||
              (isGuardsFee && (btn.action === 'pay-fee' || btn.action === 'fight-tile')) ? (
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
          <OwnedTiles gameState={gameState} updateGameState={sellAndRecheck} disableUpgradesScreen defaultExpanded />
        </div>
      )}
    </div>
  );
};
