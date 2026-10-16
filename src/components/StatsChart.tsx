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

interface StatsChartProps {
  players: Player[];
  turnStats: PlayerTurnStat[];
  statEvents: PlayerStatEvent[];
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

/** One chart: every player's power line shares the same turn axis (Y, linear,
 * increasing downward) AND the same value axis (X, log-scaled -- power spans
 * a much wider range late-game than early, so a linear axis would flatten
 * the whole early game into a sliver). Players are identified by a colored
 * circle in the legend row. */
export const StatsChart: React.FC<StatsChartProps> = ({ players, turnStats, statEvents }) => {
  const t = useT();

  const maxTurn = turnStats.reduce((m, s) => Math.max(m, s.turn), 0);
  const width = AXIS_WIDTH + PLOT_WIDTH;
  const height = TOP_PADDING + Math.max(1, maxTurn) * ROW_HEIGHT + BOTTOM_PADDING;
  const yForTurn = (turn: number) => TOP_PADDING + turn * ROW_HEIGHT;
  const turnNumbers = Array.from({ length: Math.max(1, maxTurn) }, (_, i) => i + 1);

  const powerValues = turnStats.map((s) => s.power);
  const scaleMin = powerValues.length ? Math.min(...powerValues) : 0;
  const scaleMax = powerValues.length ? Math.max(...powerValues) : 1;
  const logMin = Math.log1p(scaleMin);
  const logMax = Math.log1p(scaleMax);
  const logRange = logMax - logMin || 1;
  const xForValue = (value: number) => {
    const norm = (Math.log1p(value) - logMin) / logRange;
    return AXIS_WIDTH + PLOT_MARGIN + norm * (PLOT_WIDTH - PLOT_MARGIN * 2);
  };

  return (
    <div className="stats-chart">
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
            const points = series.map((s) => `${xForValue(s.power)},${yForTurn(s.turn)}`).join(' ');

            return (
              <g key={player.id}>
                {series.length > 0 && (
                  <polyline points={points} fill="none" stroke={player.color} strokeWidth={2.5} />
                )}
                {series.map((s) => (
                  <circle key={s.turn} cx={xForValue(s.power)} cy={yForTurn(s.turn)} r={3} fill={player.color} />
                ))}

                {events.map((ev, idx) => {
                  const stat = series.find((s) => s.turn === ev.turn);
                  const x = stat ? xForValue(stat.power) : AXIS_WIDTH + PLOT_MARGIN;
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
