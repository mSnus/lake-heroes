import React, { useState } from 'react';
import GameModal from './GameModal';
import { DecoratedButton } from './DecoratedButton';
import { clearScreen } from '../utils/screenStore';
import { GameState } from '../game/GameState';
import { SeatCode } from '../online/api';
import { getOnline, updateOnline, useOnline } from '../online/onlineStore';
import { bundleLink, groupSeats, mergeWithPrevious, splitLast } from '../online/bundles';
import { useT } from '../i18n';
import '../styles/modal.css';

interface ShareCodesScreenProps {
  /** Names the seats and says which are bots. */
  gameState?: GameState | null;
}

/**
 * The join links, one per group of seats.
 *
 * The host sees every seat, because publishing the game is the only moment the
 * server hands the full set of codes out, and can bundle neighbours with ➕ so
 * one link seats several players on the same device (hot-seat). A joiner sees
 * only what their own device holds: their GET reveals just the seats their
 * codes own.
 */
const ShareCodesScreen: React.FC<ShareCodesScreenProps> = ({ gameState }) => {
  const t = useT();
  const online = useOnline();
  const [copied, setCopied] = useState<string | null>(null);

  const codes: SeatCode[] = online.codes ?? [];
  const byPos = [...codes].sort((a, b) => a.playerIndex - b.playerIndex);
  const isHost = !!online.isHost;
  const links = online.links ?? byPos.map(() => false);
  const groups = isHost ? groupSeats(links) : byPos.length ? [byPos.map((c) => c.playerIndex)] : [];
  const codeOf = (seat: number) => byPos.find((c) => c.playerIndex === seat);
  const isBot = (seat: number) => !!gameState?.players[seat]?.isComputer;

  // The host's own device plays whichever bundle their seat is in, so changing
  // a bundle takes effect on this very page, not just on the links handed out.
  const setLinks = (next: boolean[]) => {
    const mine = groupSeats(next).find((g) => g.includes(getOnline().seat ?? 0)) ?? [getOnline().seat ?? 0];
    updateOnline({ links: next, seats: mine });
  };

  const copy = async (key: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // Clipboard blocked (insecure origin, or permission denied) — the link is
      // in the tooltip and the codes are on screen, so nothing to recover.
    }
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/king.jpg" noBorder>
      <div className="modal-content" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('online.shareTitle')}</h2>
        <h3 style={{ whiteSpace: 'pre-line' }}>
          {isHost ? t('online.shareHint') : t('online.yourLinkOnly')}
        </h3>

        <div className="online-code-list">
          {groups.map((group, gi) => {
            const members = group.map(codeOf).filter((c): c is SeatCode => !!c);
            const key = group.join('-');
            const link = bundleLink(members.map((c) => c.code));
            const prev = groups[gi - 1];
            // Bots have no device to share, so they are never bundled.
            const canMerge = isHost && !!prev && !group.some(isBot) && !prev.some(isBot);
            return (
              <div key={key} className="online-code-row">
                <span className="online-code-name">
                  {members.map((c, i) => (
                    <React.Fragment key={c.code}>
                      {i > 0 && ' + '}
                      <span style={{ color: c.color || 'inherit' }}>{c.name}</span>
                      {online.seats?.includes(c.playerIndex) && <em> {t('online.you')}</em>}
                    </React.Fragment>
                  ))}
                </span>
                <code className="online-code">{members.map((c) => c.code).join(' ')}</code>
                <button className="shield-button online-code-copy" title={link} onClick={() => copy(key, link)}>
                  {copied === key ? '✅' : '🔗'}
                </button>
                {canMerge && (
                  <button
                    className="shield-button online-code-copy"
                    title={t('online.bundleWithPrevious')}
                    onClick={() => setLinks(mergeWithPrevious(links, group))}
                  >
                    ➕
                  </button>
                )}
                {isHost && group.length > 1 && (
                  <button
                    className="shield-button online-code-copy"
                    title={t('online.unbundleLast')}
                    onClick={() => setLinks(splitLast(links, group))}
                  >
                    ✂️
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="button-group" style={{ marginTop: '16px' }}>
          <DecoratedButton onClick={() => clearScreen()}>{t('online.startPlaying')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default ShareCodesScreen;
