import React from 'react';
import { useVersionMismatch } from '../utils/useAppVersion';
import { forceFreshReload } from '../utils/forceReload';
import { useT } from '../i18n';

/**
 * Always mounted (outside the {gameState && ...} gate, so it's visible even
 * before a game starts) -- shows a small, hard-to-miss banner the instant
 * the running bundle's own baked-in version stops matching the server's
 * latest, rather than leaving that to be discovered by symptom (see
 * useVersionMismatch for why this is a direct check, not one that trusts
 * the service worker's own update machinery).
 */
export const VersionMismatchBanner: React.FC = () => {
  const t = useT();
  const { running, latest, stale } = useVersionMismatch();

  if (!stale) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#b02a2a',
        color: 'white',
        textAlign: 'center',
        padding: '6px 12px',
        fontSize: '0.9rem',
        fontFamily: 'Texturina, sans-serif',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}
      onClick={forceFreshReload}
      title={t('versionMismatch.tooltip')}
    >
      {t('versionMismatch.message', { running, latest: latest ?? '?' })}
    </div>
  );
};

export default VersionMismatchBanner;
