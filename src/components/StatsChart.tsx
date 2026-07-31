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

export interface ChartMetric {
  key: 'wealth' | 'units' | 'fame';
  label: string;
  /** SVG stroke-dasharray; omit for a solid line. */
  dash?: string;
}

interface StatsChartProps {
  players: Player[];
  turnStats: PlayerTurnStat[];
  statEvents: PlayerStatEvent[];
  /** One or more metrics drawn on the same shared turn axis. Each metric
   * gets its own independent value scale (so e.g. wealth in the thousands
   * and unit headcounts in the tens don't flatten each other), distinguished
   * by line style rather than position. */
  metrics: ChartMetric[];
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

/** Builds a log1p-based value->x mapper for one metric, independent of any
 * other metric sharing the chart. log scale so a wide value range (e.g.
 * wealth from a few hundred to tens of thousands) still fits the plot width
 * instead of squashing most turns into a sliver near one edge. log1p handles
 * a value of 0 safely (wealth/units/fame are always >= 0). */
function buildScale(turnStats: PlayerTurnStat[], key: ChartMetric['key']) {
  const values = turnStats.map((s) => s[key]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const logMin = Math.log1p(min);
  const logMax = Math.log1p(max);
  const logRange = logMax - logMin || 1;
  return (value: number) => {
    const norm = (Math.log1p(value) - logMin) / logRange;
    return AXIS_WIDTH + PLOT_MARGIN + norm * (PLOT_WIDTH - PLOT_MARGIN * 2);
  };
}

/** One chart: every player's line(s) share the same turn axis (Y, linear,
 * increasing downward), overlaid on one plot so it's easy to compare who was
 * ahead at any given turn. Players are identified by a colored circle in the
 * legend row; when multiple metrics are combined on one chart, line style
 * (solid/dashed) distinguishes them instead. */
export const StatsChart: React.FC<StatsChartProps> = ({ players, turnStats, statEvents, metrics, title }) => {
  const t = useT();

  const maxTurn = turnStats.reduce((m, s) => Math.max(m, s.turn), 0);
  const width = AXIS_WIDTH + PLOT_WIDTH;
  const height = TOP_PADDING + Math.max(1, maxTurn) * ROW_HEIGHT + BOTTOM_PADDING;
  const yForTurn = (turn: number) => TOP_PADDING + turn * ROW_HEIGHT;
  const turnNumbers = Array.from({ length: Math.max(1, maxTurn) }, (_, i) => i + 1);

  const scales = metrics.map((m) => ({ ...m, xForValue: buildScale(turnStats, m.key) }));
  // Event markers only need one anchor position -- use the chart's primary
  // (first) metric so a combined chart doesn't draw the same marker twice.
  const primaryScale = scales[0];

  return (
    <div className="stats-chart">
      <h3 className="stats-chart-title">{title}</h3>

      {metrics.length > 1 && (
        <div className="stats-chart-legend">
          {scales.map((m) => (
            <span key={m.key} className="stats-chart-legend-item">
              <svg width="22" height="10" className="stats-chart-legend-line">
                <line x1="0" y1="5" x2="22" y2="5" stroke="#ccc" strokeWidth="2" strokeDasharray={m.dash} />
              </svg>
              {m.label}
            </span>
          ))}
        </div>
      )}

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
            const events = statEvents.filter((e) => e.playerId === player.id);
            const eventDx = playerIdx % 2 === 0 ? EVENT_OFFSET : -EVENT_OFFSET;

            return (
              <g key={player.id}>
                {scales.map((m) => {
                  const points = series.map((s) => `${m.xForValue(s[m.key])},${yForTurn(s.turn)}`).join(' ');
                  return (
                    <g key={m.key}>
                      {series.length > 0 && (
                        <polyline
                          points={points}
                          fill="none"
                          stroke={player.color}
                          strokeWidth={2.5}
                          strokeDasharray={m.dash}
                        />
                      )}
                      {series.map((s) => (
                        <circle key={s.turn} cx={m.xForValue(s[m.key])} cy={yForTurn(s.turn)} r={3} fill={player.color} />
                      ))}
                    </g>
                  );
                })}

                {events.map((ev, idx) => {
                  const stat = series.find((s) => s.turn === ev.turn);
                  const x = stat ? primaryScale.xForValue(stat[primaryScale.key]) : AXIS_WIDTH + PLOT_MARGIN;
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
