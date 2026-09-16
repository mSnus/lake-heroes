import React from 'react';
import { GameState } from '../game/GameState';
import { isLocalHuman } from '../game/seats';
import { useOnline } from '../online/onlineStore';
import { useT } from '../i18n';
import '../styles/TurnWaitShield.css';

interface TurnWaitShieldProps {
  gameState: GameState;
}

/**
 * Swallows every click while the turn belongs to someone other than the human
 * at this screen — a bot, or a remote player.
 *
 * Bots were the gap: the board, the owned-tiles pane and the tile card's
 * Claim/Sell/Upgrade buttons stayed live through a bot's whole turn, so a
 * player could claim a tile or sell out from under it mid-move.
 *
 * Blocking them cannot break the bots, and that is the point of doing it with
 * an overlay rather than by disabling the controls: nothing in this codebase
 * drives the game by simulating clicks. BotController calls claimTile(),
 * sellTile() and startDiceRoll() directly (see its own comment at the claim
 * branch), the self-driving modals call their handlers from an effect, and the
 * headless sim bypasses the UI entirely. pointer-events stop humans and are
 * invisible to all three.
 *
 * The alternative is gating each of the ~15 places that ask "is this a bot?"
 * plus the always-mounted panes (owned tiles, the army/garrison stat, the
 * current tile's buy button) that ask nothing at all — far more edits, far
 * more chances to change how an offline game behaves. One overlay is provably
 * inert when no online game is active, because it renders nothing at all.
 *
 * The few inputs an overlay cannot catch — the Space key, shake-to-roll, and
 * the shield-column buttons that sit above it — are gated directly instead
 * (see ActionBar, ShieldColumn and game/seats).
 */
const TurnWaitShield: React.FC<TurnWaitShieldProps> = ({ gameState }) => {
  const t = useT();
  const online = useOnline();

  // "Is the active player a human sitting at THIS screen" -- the same question
  // ShieldColumn asks to hide the roll and end-turn buttons. Offline that is
  // just !isComputer; online it also excludes the other players' seats, and a
  // bot the host drives (the host is running that turn, but is not playing it,
  // so its own board must be just as inert).
  if (isLocalHuman(gameState.activePlayer)) return null;

  const waitingFor = gameState.activePlayer;
  const failed = online.sync === 'error';

  return (
    <div className="turn-wait-shield" aria-live="polite">
      <div className="turn-wait-plate">
        <span className="turn-wait-dot" style={{ background: waitingFor.color }} />
        <span>{t('online.waitingFor', { playerName: waitingFor.name })}</span>
        {failed && <span className="turn-wait-error">{t('online.connectionLost')}</span>}
      </div>
    </div>
  );
};

export default TurnWaitShield;
