import React from 'react';
import { GameState } from '../../game/GameState';
import { useScreen } from '../../utils/screenStore';
import { afterMoveLogic } from '../../actions/afterMoveLogic';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { OwnedTiles } from '../dashboard/OwnedTiles';
import { DecoratedButton } from '../ui/DecoratedButton';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { Militia } from '../snippets/Militia';
import { Rider } from '../snippets/Rider';
import { Tower } from '../snippets/Tower';
import { SpriteCircleIcon } from '../snippets/SpriteCircleIcon';
import { gameEvent } from '../../utils/events';
import { formatArmy } from '../../utils/formatArmy';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';

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

  const sellAndRecheck = (gs: GameState) => {
    updateGameState(gs);
    afterMoveLogic(gs, updateGameState);
  };

  const buttons = config.buttons ?? [];

  // Follows whichever line names the tile's guard -- "belongs to OWNER" when
  // it's owned, or straight after "encounters TILE" when it's an unowned
  // wild guard -- rather than trailing the whole encounter block (which used
  // to land it after the raze-or-pay prompt, reading like it belonged there).
  const guardedByNode = config.encounter?.tile && (
    <> {t('screenRenderer.andIsGuarded', { amount: config.encounter.tile.defence })}</>
  );

  // The toll screen reads as the owner acting on the visitor, so it drops
  // the visitor's own stat line and the "encounters ... belongs to" build-up.
  const isToll = !!config.encounter?.ownerName && !!config.encounter?.fee;

  // The revenge prompt takes the place of the standalone "guarded by" line.
  const showsRevengePrompt = !!(config.encounter?.ownerName && config.encounter?.canFight && config.encounter?.tile);

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
            {isToll ? (
              <>
                <PlayerLabel name={config.encounter.playerName} color={config.encounter.playerColor} bold />{' '}
                <Militia amount={config.encounter.militia ?? 0} color={config.encounter.playerImage} />
                {(config.encounter.riders ?? 0) > 0 && (
                  <Rider amount={config.encounter.riders!} color={config.encounter.playerImage} />
                )}
                {config.encounter.fame !== undefined && <Fame amount={config.encounter.fame} />}
                <Gold amount={config.encounter.gold ?? 0} />
                <br />
                {tJsx('screenRenderer.wasForcedBy', {
                  owner: <PlayerLabel name={config.encounter.ownerName!} color={config.encounter.ownerColor} bold />,
                  amount:
                    config.encounter.goldBefore === undefined
                      ? t('screenRenderer.forcedToPayAmount', { amount: config.encounter.fee ?? 0 })
                      : t('screenRenderer.forcedToPayAmountFrom', {
                          amount: config.encounter.fee ?? 0,
                          before: config.encounter.goldBefore,
                          after: config.encounter.gold ?? 0,
                        }),
                })}
                <br />
                {tJsx('screenRenderer.forTheTile', {
                  tile: (
                    <strong style={{ color: config.encounter.tile?.groupTextColor }}>
                      {config.encounter.tile?.name}
                    </strong>
                  ),
                  towers: Array.from({ length: config.encounter.tile?.level ?? 0 }, (_, i) => <Tower key={i} />),
                })}
              </>
            ) : (
              <>
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
                    {!showsRevengePrompt && guardedByNode}
                  </>
                )}
              </>
            )}
            {showsRevengePrompt && (
              <>
                <br />
                <br />
                {t('screenRenderer.riskOrPay')}
                <br />
                <span style={{ fontSize: '1rem', lineHeight: '1', color: 'wheat' ,opacity: 0.85 }}>
                  {t('screenRenderer.razedSmokeCaveat')}
                </span>
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

        {!config.sellMode && (
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
      )}
      </ScreenBackground>

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
