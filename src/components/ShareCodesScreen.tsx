import React, { useState } from 'react';
import GameModal from './GameModal';
import { DecoratedButton } from './DecoratedButton';
import { clearScreen } from '../utils/screenStore';
import { GameState } from '../game/GameState';
import { SeatCode } from '../online/api';
import { useOnline } from '../online/onlineStore';
import { useT } from '../i18n';
import '../styles/modal.css';

interface ShareCodesScreenProps {
  /** Only used to name the seat when we hold a single code (a joiner). */
  gameState?: GameState | null;
}

/** The link a player opens to take their seat. Built from the current address
 * so it works from a versioned deploy path as well as from localhost. */
function seatLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?code=${code}`;
}

/**
 * The join codes, one per seat.
 *
 * The host sees every seat, because publishing the game is the only moment the
 * server hands the full set out. A joiner sees only their own: their GET
 * reveals just the seat their code owns, and the server will not enumerate the
 * rest — so this screen shows them their own link (useful for reopening the
 * game on another device) rather than pretending to know the others.
 */
const ShareCodesScreen: React.FC<ShareCodesScreenProps> = ({ gameState }) => {
  const t = useT();
  const online = useOnline();
  const [copied, setCopied] = useState<string | null>(null);

  const rows: SeatCode[] =
    online.codes ??
    (online.code !== undefined && online.seat !== undefined
      ? [
          {
            code: online.code,
            playerIndex: online.seat,
            color: gameState?.players[online.seat]?.color ?? '',
            name: gameState?.players[online.seat]?.name ?? '',
          },
        ]
      : []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(seatLink(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      // Clipboard blocked (insecure origin, or permission denied) — the link is
      // on screen to copy by hand, so there is nothing to recover from.
    }
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/king.jpg" noBorder>
      <div className="modal-content" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('online.shareTitle')}</h2>
        <h3 style={{ whiteSpace: 'pre-line' }}>
          {online.codes ? t('online.shareHint') : t('online.yourLinkOnly')}
        </h3>

        <div className="online-code-list">
          {rows.map((c) => (
            <div key={c.code} className="online-code-row">
              <span className="online-code-name" style={{ color: c.color || 'inherit' }}>
                {c.name}
                {c.playerIndex === online.seat && <em> {t('online.you')}</em>}
              </span>
              <code className="online-code">{c.code}</code>
              <button
                className="shield-button online-code-copy"
                title={seatLink(c.code)}
                onClick={() => copy(c.code)}
              >
                {copied === c.code ? '✅' : '🔗'}
              </button>
            </div>
          ))}
        </div>

        <div className="button-group" style={{ marginTop: '16px' }}>
          <DecoratedButton onClick={() => clearScreen()}>{t('online.startPlaying')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default ShareCodesScreen;
