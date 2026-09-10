import React from 'react';
import { GameState } from '../game/GameState';
import { isLocalTurn, isLocallyDriven } from '../game/seats';
import { useOnline } from '../online/onlineStore';
import { useT } from '../i18n';
import '../styles/OnlineWaitShield.css';

interface OnlineWaitShieldProps {
  gameState: GameState;
}

/**
 * Swallows every click while another player is taking their turn.
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
const OnlineWaitShield: React.FC<OnlineWaitShieldProps> = ({ gameState }) => {
  const t = useT();
  const online = useOnline();

  // Bot seats the host drives are "ours" for input purposes: the host's client
  // is running that turn, so its own UI must stay live.
  if (isLocalTurn(gameState) || isLocallyDriven(gameState.activePlayer, gameState)) return null;

  const waitingFor = gameState.activePlayer;
  const failed = online.sync === 'error';

  return (
    <div className="online-wait-shield" aria-live="polite">
      <div className="online-wait-plate">
        <span className="online-wait-dot" style={{ background: waitingFor.color }} />
        <span>{t('online.waitingFor', { playerName: waitingFor.name })}</span>
        {failed && <span className="online-wait-error">{t('online.connectionLost')}</span>}
      </div>
    </div>
  );
};

export default OnlineWaitShield;
