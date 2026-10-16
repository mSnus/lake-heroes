import React, { useEffect, useState } from 'react';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { SPRITE_SIZE } from '../../game/constants';
import { ScreenBackground } from './ScreenBackground';
import { DecoratedButton } from '../ui/DecoratedButton';
import { useT } from '../../i18n';

interface PortalScreenProps {
  player: Player;
  landedTile: Tile;
  onContinue: () => void;
}

const REVEAL_DELAY_MS = 1000;
const BOT_CONTINUE_DELAY_MS = 1800;

/** Portal's post-teleport screen: the disorientation message appears at
 * once, then — after a beat, faded in rather than popping in — a second
 * block reveals where the player actually landed, with the Continue button
 * living inside that block (so there's nothing to click until it's shown). */
export const PortalScreen: React.FC<PortalScreenProps> = ({ player, landedTile, onContinue }) => {
  const t = useT();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!player.isComputer) return;
    const timer = setTimeout(() => onContinue(), BOT_CONTINUE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ScreenBackground image="assets/screens/portal.jpg">
      <div className="text-title">{t('portal.title')}</div>
      <div className="text-message">{t('portal.message', { playerName: player.name })}</div>
      <div
        className="text-message"
        style={{
          marginTop: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          opacity: revealed ? 1 : 0,
          pointerEvents: revealed ? 'auto' : 'none',
          transition: 'opacity 1s ease',
        }}
      >
        <div>{t('portal.surprised')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {landedTile.spriteImage && (
            <div
              style={{
                width: SPRITE_SIZE / 2,
                height: SPRITE_SIZE / 2,
                backgroundImage: `url(${landedTile.spriteImage})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                borderRadius: SPRITE_SIZE / 2,
              }}
            />
          )}
          <strong>{landedTile.name}</strong>
        </div>
        <DecoratedButton onClick={onContinue}>{t('portal.whereAreYou')}</DecoratedButton>
      </div>
    </ScreenBackground>
  );
};
