import React from 'react';
import { GameState } from '../../game/GameState';
import { useScreen } from '../../utils/screenStore';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { DecoratedButton } from '../ui/DecoratedButton';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { SpriteCircleIcon } from '../snippets/SpriteCircleIcon';
import { gameEvent } from '../../utils/events';
import { formatArmy } from '../../utils/formatArmy';
import { useT } from '../../i18n';

interface ScreenRendererProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

export const ScreenRenderer: React.FC<ScreenRendererProps> = ({ gameState }) => {
  const t = useT();
  const config = useScreen();
  if (!config) return null;

  // King's Castle, the Tavern's recruiting screen, and the guards/fee
  // encounter are pure bookkeeping for a bot — it drives them headlessly
  // (KingsCastleModal/TavernModal's self-driving effect / BotController), so
  // hide just these rather than flashing them at a human who has nothing to
  // do this turn. Other screens stay visible.
  const isSelfDrivingModal = config.screenType === 'kings-castle' || config.screenType === 'tavern-result' || config.screenType === 'stables-result';
  const isGuardsFee = !!config.encounter && config.encounter.canFight !== undefined;
  const isCaravan = config.screenType === 'caravan';

  const hideForBot = gameState.activePlayer.isComputer && (isSelfDrivingModal || isGuardsFee);
  const hiddenStyle: React.CSSProperties | undefined = hideForBot
    ? { opacity: 0, pointerEvents: 'none' }
    : undefined;

  if (config.content) {
    return isSelfDrivingModal ? <div style={hiddenStyle}>{config.content}</div> : <>{config.content}</>;
  }

  const buttons = config.buttons ?? [];

  // Follows whichever line names the tile's guard -- "belongs to OWNER" when
  // it's owned, or straight after "encounters TILE" when it's an unowned
  // wild guard -- rather than trailing the whole encounter block (which used
  // to land it after the raze-or-pay prompt, reading like it belonged there).
  const guardedByNode = config.encounter?.tile && (
    <> {t('screenRenderer.andIsGuarded', { amount: config.encounter.tile.defence })}</>
  );

  function handleButtonClick(onClick: () => void, action?: string) {
    if (action === 'end-turn') gameEvent('setPhase', 'before-move');
    try {
      onClick();
    } catch {}
  }

  return (
    <div style={hiddenStyle} className={isGuardsFee ? 'guards-fee-screen' : undefined}>
      <ScreenBackground
        image={config.background!}
        style={
          config.screenType === 'ambush'
            ? { paddingTop: '2rem' }
            : undefined
        }
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
            /><br/>
            {config.encounter?.gold !== undefined && (
              <>
                <strong>
                  <Gold amount={config.encounter.gold} />
                </strong>
                <strong>{formatArmy(config.encounter.militia ?? 0, config.encounter.riders ?? 0)}</strong>
              </>
            )}
            <br />
            {t('screenRenderer.encounters')}{' '}
            <strong style={{ color: config.encounter.tile?.groupTextColor }}>
              {config.encounter.tile?.name}
            </strong>
            {!config.encounter.ownerName && guardedByNode}
            {config.encounter.ownerName && (
              <>
                <br />
                {t('screenRenderer.belongsTo')}{' '}
                <PlayerLabel
                  name={config.encounter.ownerName}
                  color={config.encounter.ownerColor}
                  bold
                />
                {guardedByNode}
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

        <div
          className={'game-menu' + (isGuardsFee ? ' pay-or-fight-grid' : '')}
          style={
            // 2 buttons -> 2x1, 3 -> 3x1, 4 -> 2x2 (wraps automatically at 2 cols).
            isGuardsFee ? ({ '--pay-or-fight-cols': buttons.length === 4 ? 2 : buttons.length } as React.CSSProperties) : undefined
          }
        >
            {buttons.map((btn, i) =>
              // The caravan and guards/fee screens decorate every button;
              // everything else stays as plain menu buttons.
              buttons.length === 1 || isCaravan || isGuardsFee ? (
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
      </ScreenBackground>
    </div>
  );
};
