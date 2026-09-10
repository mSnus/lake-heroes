import React, { useState } from 'react';
import GameModal from './GameModal';
import { DecoratedButton } from './DecoratedButton';
import { clearScreen } from '../utils/screenStore';
import { SeatCode } from '../online/api';
import { useT } from '../i18n';
import '../styles/modal.css';

interface ShareCodesScreenProps {
  codes: SeatCode[];
}

/** The link a player opens to take their seat. Relative to wherever the game
 * is served, so it works from a versioned deploy path as well as localhost. */
function seatLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?code=${code}`;
}

/**
 * Shown once, to the host, right after a game is published: one join code per
 * seat. Seat 0 is the host's own — the others have to be delivered by hand,
 * since the server knows nothing about who the players are.
 */
const ShareCodesScreen: React.FC<ShareCodesScreenProps> = ({ codes }) => {
  const t = useT();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(seatLink(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      // Clipboard blocked (insecure origin, or denied) — the link is on screen
      // to copy by hand, so there is nothing to recover from.
    }
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/king.jpg" noBorder>
      <div className="modal-content" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('online.shareTitle')}</h2>
        <h3 style={{ whiteSpace: 'pre-line' }}>{t('online.shareHint')}</h3>

        <div className="online-code-list">
          {codes.map((c, i) => (
            <div key={c.code} className="online-code-row">
              <span className="online-code-name" style={{ color: c.color || 'inherit' }}>
                {c.name}
                {i === 0 && <em> {t('online.you')}</em>}
              </span>
              <code className="online-code">{c.code}</code>
              <button className="shield-button online-code-copy" onClick={() => copy(c.code)}>
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
