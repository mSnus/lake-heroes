import React from 'react';
import { Player } from '../game/Player';
import { PlayerTurnStat, PlayerStatEvent, StatEventType } from '../game/statistics';
import { useT } from '../i18n';

export const EVENT_EMOJI: Record<StatEventType, string> = {
  sphynx: '🦁',
  joker: '🃏',
  'battle-won': '⚔️',
  'battle-lost': '💀',
  treasure: '📦',
  promotion: '🎖️',
  dragon: '🐉',
};

interface StatsChartProps {
  players: Player[];
  turnStats: PlayerTurnStat[];
  statEvents: PlayerStatEvent[];
  metric: 'wealth' | 'units' | 'fame';
  title: string;
}

const PLOT_WIDTH = 560;
const PLOT_MARGIN = 20; // inset from the plot's edges the line is allowed to swing to
const ROW_HEIGHT = 26;
const TOP_PADDING = 56;
const BOTTOM_PADDING = 20;
const AXIS_WIDTH = 34;
// Event markers for different players landing on/near the same point are
// nudged apart by this much so they don't fully overlap.
const EVENT_OFFSET = 14;

/** One metric's graph: every player's line shares the same value axis (X)
 * and turn axis (Y, increasing downward), overlaid on one plot so it's easy
 * to compare who was ahead at any given turn. Players are identified by a
 * colored circle in the legend row above the plot. */
export const StatsChart: React.FC<StatsChartProps> = ({ players, turnStats, statEvents, metric, title }) => {
  const t = useT();

  const maxTurn = turnStats.reduce((m, s) => Math.max(m, s.turn), 0);
  const values = turnStats.map((s) => s[metric]);
  const valueMin = values.length ? Math.min(...values) : 0;
  const valueMax = values.length ? Math.max(...values) : 1;
  const range = valueMax - valueMin || 1;

  const width = AXIS_WIDTH + PLOT_WIDTH;
  const height = TOP_PADDING + Math.max(1, maxTurn) * ROW_HEIGHT + BOTTOM_PADDING;

  const xForValue = (value: number) => {
    const norm = (value - valueMin) / range;
    return AXIS_WIDTH + PLOT_MARGIN + norm * (PLOT_WIDTH - PLOT_MARGIN * 2);
  };
  const yForTurn = (turn: number) => TOP_PADDING + turn * ROW_HEIGHT;

  const turnNumbers = Array.from({ length: Math.max(1, maxTurn) }, (_, i) => i + 1);

  return (
    <div className="stats-chart">
      <h3 className="stats-chart-title">{title}</h3>

      <div className="stats-chart-legend">
        {players.map((player) => (
          <span key={player.id} className="stats-chart-legend-item">
            <span className="stats-chart-legend-dot" style={{ background: player.color }} />
            {player.name}
          </span>
        ))}
      </div>

      <div className="stats-chart-scroll">
        <svg width={width} height={height} className="stats-chart-svg">
          {turnNumbers.map((turn) => (
            <g key={`grid-${turn}`}>
              <line x1={AXIS_WIDTH} y1={yForTurn(turn)} x2={width} y2={yForTurn(turn)} className="stats-chart-gridline" />
              <text x={4} y={yForTurn(turn) + 4} className="stats-chart-axis-label">
                {turn}
              </text>
            </g>
          ))}

          {players.map((player, playerIdx) => {
            const series = turnStats
              .filter((s) => s.playerId === player.id)
              .sort((a, b) => a.turn - b.turn);
            const points = series.map((s) => `${xForValue(s[metric])},${yForTurn(s.turn)}`).join(' ');
            const events = statEvents.filter((e) => e.playerId === player.id);
            const eventDx = playerIdx % 2 === 0 ? EVENT_OFFSET : -EVENT_OFFSET;

            return (
              <g key={player.id}>
                {series.length > 0 && <polyline points={points} fill="none" stroke={player.color} strokeWidth={2.5} />}
                {series.map((s) => (
                  <circle key={s.turn} cx={xForValue(s[metric])} cy={yForTurn(s.turn)} r={3} fill={player.color} />
                ))}

                {events.map((ev, idx) => {
                  const stat = series.find((s) => s.turn === ev.turn);
                  const x = stat ? xForValue(stat[metric]) : AXIS_WIDTH + PLOT_MARGIN;
                  const y = yForTurn(ev.turn);
                  const label =
                    ev.type === 'battle-won' || ev.type === 'battle-lost'
                      ? `${player.name}: ${t(`statsScreen.event.${ev.type}`)} ${t('statsScreen.vsOpponent', { opponent: ev.opponentName ?? '' })}`
                      : `${player.name}: ${t(`statsScreen.event.${ev.type}`)}`;
                  return (
                    <text
                      key={`${ev.type}-${ev.turn}-${idx}`}
                      x={x + eventDx}
                      y={y + 5}
                      textAnchor={eventDx > 0 ? 'start' : 'end'}
                      fontSize={15}
                      className="stats-chart-event-marker"
                    >
                      <title>{label}</title>
                      {EVENT_EMOJI[ev.type]}
                    </text>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
