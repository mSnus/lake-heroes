import React from 'react';
import { GameState } from '../game/GameState';
import { clearScreen } from '../utils/screenStore';
import { StatEventType } from '../game/statistics';
import { StatsChart, EVENT_EMOJI } from './StatsChart';
import { useT } from '../i18n';
import '../styles/StatsScreen.css';

interface StatsScreenProps {
  gameState: GameState;
}

const EVENT_TYPES: StatEventType[] = [
  'sphynx',
  'joker',
  'battle-won',
  'battle-lost',
  'treasure',
  'promotion',
  'dragon',
];

const StatsScreen: React.FC<StatsScreenProps> = ({ gameState }) => {
  const t = useT();
  const { players, turnStats, statEvents } = gameState;

  return (
    <div className="stats-screen">
      <div className="stats-screen-inner">
        <div className="stats-screen-header">
          <h2 className="stats-screen-title">📈 {t('statsScreen.title')}</h2>
          <button onClick={clearScreen} className="stats-screen-close">
            ✕
          </button>
        </div>

        <div className="stats-screen-legend">
          <strong>{t('statsScreen.legend')}:</strong>
          {EVENT_TYPES.map((type) => (
            <span key={type} className="stats-screen-legend-item">
              {EVENT_EMOJI[type]} {t(`statsScreen.event.${type}`)}
            </span>
          ))}
        </div>

        {turnStats.length === 0 ? (
          <p className="stats-screen-empty">{t('statsScreen.noData')}</p>
        ) : (
          <>
            <StatsChart
              players={players}
              turnStats={turnStats}
              statEvents={statEvents}
              metrics={[
                { key: 'wealth', label: `🟡 ${t('statsScreen.wealth')}` },
                { key: 'units', label: `🧍 ${t('statsScreen.units')}`, dash: '5 4' },
              ]}
              title={`🟡 ${t('statsScreen.wealth')} / 🧍 ${t('statsScreen.units')}`}
            />
            <StatsChart
              players={players}
              turnStats={turnStats}
              statEvents={statEvents}
              metrics={[{ key: 'fame', label: `🏆 ${t('statsScreen.fame')}` }]}
              title={`🏆 ${t('statsScreen.fame')}`}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default StatsScreen;
