import React from 'react';
import { Player } from '../game/Player';
import { PlayerTurnStat, PlayerStatEvent, StatEventType } from '../game/statistics';
import { useT } from '../i18n';

export const EVENT_EMOJI: Record<StatEventType, string> = {
  sphynx: '🦁',
  joker: '🃏',
  'battle-won': '⚔️',
  'battle-lost': '💀',
  treasure: '🪎',
  promotion: '🎖️',
  dragon: '🐉',
  'kings-castle': '🏰',
};

export interface ChartMetric {
  key: 'wealth' | 'units' | 'fame';
  label: string;
  /** SVG stroke-dasharray; omit for a solid line. Ignored if `dotted`. */
  dash?: string;
  /** Renders a dotted line (round-capped short dashes) instead of `dash`. */
  dotted?: boolean;
  /** Line/dot opacity, 0-1; omit for fully opaque. */
  opacity?: number;
}

interface StatsChartProps {
  players: Player[];
  turnStats: PlayerTurnStat[];
  statEvents: PlayerStatEvent[];
  /** One or more metrics drawn on the same shared turn axis AND the same
   * shared value axis (see the scaling comment below), distinguished by
   * line style rather than position. */
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

const rawMax = (turnStats: PlayerTurnStat[], key: ChartMetric['key']): number => {
  const values = turnStats.map((s) => s[key]);
  return values.length ? Math.max(...values) : 0;
};

/** One chart: every player's line(s) share the same turn axis (Y, linear,
 * increasing downward) AND the same value axis (X, log-scaled). Metrics with
 * very different natural ranges (wealth in the thousands vs. fame in the
 * tens) are equalized first: every non-anchor metric is multiplied by
 * anchorMax/thisMetricMax so its own highest-reached value lines up with the
 * anchor metric's highest-reached value, before all of them share one log
 * scale -- otherwise a small-range metric plotted on a shared scale built
 * from a much larger one would barely move. 'wealth' is the anchor when
 * present (falls back to the first listed metric otherwise). Players are
 * identified by a colored circle in the legend row. */
export const StatsChart: React.FC<StatsChartProps> = ({ players, turnStats, statEvents, metrics, title }) => {
  const t = useT();

  const maxTurn = turnStats.reduce((m, s) => Math.max(m, s.turn), 0);
  const width = AXIS_WIDTH + PLOT_WIDTH;
  const height = TOP_PADDING + Math.max(1, maxTurn) * ROW_HEIGHT + BOTTOM_PADDING;
  const yForTurn = (turn: number) => TOP_PADDING + turn * ROW_HEIGHT;
  const turnNumbers = Array.from({ length: Math.max(1, maxTurn) }, (_, i) => i + 1);

  const anchorKey = metrics.some((m) => m.key === 'wealth') ? 'wealth' : metrics[0].key;
  const anchorMax = rawMax(turnStats, anchorKey) || 1;
  const metricsWithCoef = metrics.map((m) => {
    if (m.key === anchorKey) return { ...m, coef: 1 };
    const thisMax = rawMax(turnStats, m.key);
    return { ...m, coef: thisMax > 0 ? anchorMax / thisMax : 1 };
  });

  const adjustedValues = metricsWithCoef.flatMap((m) => turnStats.map((s) => s[m.key] * m.coef));
  const scaleMin = adjustedValues.length ? Math.min(...adjustedValues) : 0;
  const scaleMax = adjustedValues.length ? Math.max(...adjustedValues) : 1;
  const logMin = Math.log1p(scaleMin);
  const logMax = Math.log1p(scaleMax);
  const logRange = logMax - logMin || 1;
  const xForAdjusted = (adjustedValue: number) => {
    const norm = (Math.log1p(adjustedValue) - logMin) / logRange;
    return AXIS_WIDTH + PLOT_MARGIN + norm * (PLOT_WIDTH - PLOT_MARGIN * 2);
  };

  const scales = metricsWithCoef.map((m) => ({ ...m, xForValue: (value: number) => xForAdjusted(value * m.coef) }));
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
                <line
                  x1="0"
                  y1="5"
                  x2="22"
                  y2="5"
                  stroke="#ccc"
                  strokeWidth="2"
                  strokeDasharray={m.dotted ? '0.1 7' : m.dash}
                  strokeLinecap={m.dotted ? 'round' : undefined}
                  opacity={m.opacity}
                />
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
        <svg viewBox={`0 0 ${width} ${height}`} className="stats-chart-svg">
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
                          strokeDasharray={m.dotted ? '0.1 7' : m.dash}
                          strokeLinecap={m.dotted ? 'round' : undefined}
                          opacity={m.opacity}
                        />
                      )}
                      {series.map((s) => (
                        <circle
                          key={s.turn}
                          cx={m.xForValue(s[m.key])}
                          cy={yForTurn(s.turn)}
                          r={3}
                          fill={player.color}
                          opacity={m.opacity}
                        />
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
