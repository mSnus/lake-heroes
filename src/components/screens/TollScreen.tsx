import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from '../snippets/SpriteCircleIcon';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { Militia } from '../snippets/Militia';
import { Rider } from '../snippets/Rider';
import { Tower } from '../snippets/Tower';
import { DecoratedButton } from '../ui/DecoratedButton';
import { clearScreen } from '../../utils/screenStore';
import { setEndTurn } from '../../utils/endTurnStore';
import { chargeToll, triggerPrisonerOfWar } from '../../actions/afterMoveLogic';
import { fightTile } from '../../actions/fightTile';
import { sellTile, sellRefund } from '../../actions/sellTile';
import { yieldTile, yieldRefund } from '../../actions/yieldTile';
import { shouldSeekRevenge, sortTilesBySacrifice } from '../../ai/decisions';
import { fmtPrice } from '../board/TileCard';
import { announce } from '../../utils/announce';
import { changeKarma } from '../../utils/karma';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';
import '../../styles/GameMenu.css';
import '../../styles/TollScreen.css';

interface TollScreenProps {
  gameState: GameState;
  player: Player;
  tile: Tile;
  owner: Player | undefined;
  fee: number;
  canFight: boolean;
  /** The payer's gold right before the very first charge, for the struck-
   * through before -> after display. Undefined on a re-entry that already
   * settled the toll (e.g. after a lost revenge attack), which charges
   * nothing fresh and has no "before" to show. */
  goldBefore?: number;
  updateGameState: (board: GameState) => void;
}

const BOT_STEP_DELAY_MS = 600;

/**
 * The owned-tile encounter from landing on another player's land: the toll
 * is already auto-charged by the time this mounts (see
 * afterMoveLogic.ts's showTileEncounterScreen), and this screen is the one
 * place for whatever happens next -- selling/yielding tiles toward a
 * shortfall (or going to prison once there's nothing left to sell), then,
 * the moment it's settled, the peace/revenge choice -- all as one screen
 * that re-renders itself as the player's own gold/tiles change, rather than
 * a stack of separate screens replacing each other.
 */
export const TollScreen: React.FC<TollScreenProps> = ({
  gameState,
  player,
  tile,
  owner,
  fee,
  canFight,
  goldBefore,
  updateGameState,
}) => {
  const t = useT();
  const [, forceRerender] = useState(0);
  const refresh = () => {
    updateGameState(gameState);
    forceRerender((v) => v + 1);
  };

  const settled = player.hasSettledTollThisTurn;
  const remaining = player.owedToll;

  const ownedTiles = player.ownedTiles
    .map((idx) => ({ idx, tile: gameState.tiles[idx] }))
    .filter((r): r is { idx: number; tile: Tile } => !!r.tile && r.tile.owner === player.id);

  // Selling/yielding only raises gold -- re-charge afterward so the newly
  // raised gold is actually applied toward the debt (chargeToll reads
  // player.owedToll itself, so repeated calls only ever take what's still
  // owed).
  const settleAfterSale = () => {
    const left = chargeToll(player, owner, tile, fee);
    if (left <= 0) player.hasSettledTollThisTurn = true;
    refresh();
  };

  const handleSell = (target: Tile) => {
    const refund = sellRefund(target);
    if (
      !window.confirm(
        t('tileCard.confirmSell', { tileName: target.name, price: fmtPrice(refund.gold, refund.units, t('common.and')) })
      )
    )
      return;
    sellTile(gameState, player, target);
    settleAfterSale();
  };

  const handleYield = (target: Tile) => {
    const refund = yieldRefund(target);
    if (!window.confirm(t('tileCard.confirmYield', { tileName: target.name, gold: refund }))) return;
    yieldTile(gameState, player, target);
    settleAfterSale();
  };

  const handleGoWithPeace = () => {
    player.hasResolvedTileEncounterThisTurn = true;
    changeKarma(player, 1, 3);
    clearScreen();
    setEndTurn();
  };

  const handleRevenge = () => fightTile(gameState, updateGameState);

  const handlePrison = () => triggerPrisonerOfWar(gameState, updateGameState, owner);

  // A live (non-headless) bot's turn through this same screen: sell the
  // least valuable tile at a time until the toll is covered (or there's
  // nothing left, then prison), exactly the decision afterMoveLogic.ts's
  // own headless path makes -- then the same peace/revenge call a human's
  // buttons would make.
  const stepRef = useRef(false);
  useEffect(() => {
    if (!player.isComputer || stepRef.current) return;
    stepRef.current = true;
    let cancelled = false;
    const wait = () => new Promise<void>((resolve) => setTimeout(resolve, BOT_STEP_DELAY_MS));

    (async () => {
      while (!cancelled && player.owedToll > 0) {
        const target = sortTilesBySacrifice(gameState, player)[0];
        if (!target) break;
        announce(player, 'botController.sellTilesToPayFee');
        await wait();
        if (cancelled) return;
        sellTile(gameState, player, target);
        settleAfterSale();
      }

      if (cancelled) return;
      if (player.owedToll > 0) {
        announce(player, 'botController.acceptTheLoss');
        await wait();
        if (!cancelled) handlePrison();
        return;
      }

      const revenge = canFight && shouldSeekRevenge(player, tile.defence);
      announce(player, revenge ? 'botController.fight' : 'botController.noRevenge', { tile: tile.shortName });
      await wait();
      if (cancelled) return;
      if (revenge) handleRevenge();
      else handleGoWithPeace();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScreenBackground image="assets/screens/guards.jpg" style={{ paddingTop: '1rem' }}>
      <Fade />
      {/* Above the screen's Fade (z-index 5501) -- a position:static
          element's own z-index is inert, so every interactive block needs
          to sit inside one positioned, elevated box (see ArmyScreen.tsx's
          identical fix). */}
      <div className="toll-screen-content">
        {tile.spriteImage && <SpriteCircleIcon src={tile.spriteImage} />}
        <div className="text-message">
          <PlayerLabel name={player.name} color={player.color} bold />
          <br />
          <Militia amount={player.militia} color={player.image} knight={player.isKnight} />
          {player.riders > 0 && <Rider amount={player.riders} color={player.image} />}
          <Fame amount={player.fame} />
          {goldBefore !== undefined && (
            <>
              <span className="gold-struck">
                <Gold amount={goldBefore} />
              </span>{' '}
              →{' '}
            </>
          )}
          <Gold amount={player.gold} />
          <br />
          {tJsx('screenRenderer.wasForcedToPay', { amount: <Gold amount={fee} /> })}
          <br />
          {owner &&
            tJsx('screenRenderer.toOwner', {
              owner: <PlayerLabel name={owner.name} color={owner.color} bold />,
            })}
          <br />
          {tJsx('screenRenderer.forTheTile', {
            tile: <strong style={{ color: tile.groupTextColor }}>{tile.name}</strong>,
            towers: Array.from({ length: tile.level }, (_, i) => <Tower key={i} />),
          })}
        </div>

        {!settled ? (
          <div className="toll-sell-dialogue">
            <div className="text-message toll-pay-more">
              {tJsx('tollScreen.payMoreHeader', { amount: <Gold amount={remaining} /> })}
            </div>

            <div className="toll-tile-row">
              {ownedTiles.map(({ idx, tile: t2 }) => (
                <div className="toll-tile-block" key={idx}>
                  {t2.spriteImage && (
                    <SpriteCircleIcon src={t2.spriteImage} size="3rem" style={{ marginBottom: 0 }} />
                  )}
                  <div className="toll-tile-name">{t2.shortName}</div>
                  {!t2.isYielded && (
                    <button className="toll-tile-button" onClick={() => handleYield(t2)}>
                      {tJsx('tollScreen.yieldFor', { gold: <Gold amount={yieldRefund(t2)} /> })}
                    </button>
                  )}
                  <button className="toll-tile-button" onClick={() => handleSell(t2)}>
                    {tJsx('tollScreen.sellFor', { gold: <Gold amount={sellRefund(t2).gold} /> })}
                  </button>
                </div>
              ))}
            </div>

            {ownedTiles.length === 0 && (
              <div className="game-menu">
                <DecoratedButton onClick={handlePrison}>{t('tollScreen.goToPrison')}</DecoratedButton>
              </div>
            )}
          </div>
        ) : (
          <div className="game-menu pay-or-fight-grid" style={{ '--pay-or-fight-cols': 2 } as React.CSSProperties}>
            <DecoratedButton onClick={handleGoWithPeace}>{t('afterMoveLogic.goWithPeace')}</DecoratedButton>
            <DecoratedButton disabled={!canFight} onClick={handleRevenge}>
              {t('afterMoveLogic.revenge')}
            </DecoratedButton>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};

export default TollScreen;
