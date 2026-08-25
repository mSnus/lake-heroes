import React, { useEffect, useState } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { buildTilesFromTemplates } from '../game/TileSet';
import tilesData from '../settings/tiles.json';
import { TileJSON } from '../game/Tile';
import { gameStart } from '../actions/gameStart';
import { runHeadlessGame, HeadlessStopReason } from '../game/economy/headlessDriver';
import { getOverrides, setHeadlessOverrides } from '../utils/overridesStore';
import { totalWealth } from '../game/wealth';
import { getArtifact } from '../game/artifacts';
import { getSimLog, getSimIncome, getSimTileVisits, getSimCircleSnapshot } from '../utils/simLogStore';
import { formatUnits, formatCellStats } from '../utils/formatPlayerCell';
import { clearScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { useT, getLanguage, setLanguage } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

const PLAYER_COLORS = ['blue', 'red', 'green', 'yellow'];
const PLAYER_SWATCH: Record<string, string> = { blue: '🔵', red: '🔴', green: '🟢', yellow: '🟡' };

interface PlayerSnapshot {
  fame: number;
  gold: number;
  militia: number;
  riders: number;
  tilesOwned: number;
  /** Compact names of every tile owned at this snapshot, shown under the
   * stats line. */
  tileNames: string[];
  wealth: number;
  artifactsEmoji: string;
  isPOW: boolean;
  /** What happened to this player during this circle -- filled in after the
   * run from the sim log (see attachLogs). */
  log: string[];
  /** Tile income collected across every turn this circle -- filled in after
   * the run from the sim income accumulator, alongside log. */
  dailyIncome: { gold: number; units: number };
  /** Short names of every tile stepped onto this circle, in order -- filled
   * in after the run from the sim tile-visit accumulator, alongside log. */
  tileSequence: string[];
  /** Stat line (see formatCellStats) at the moment this circle began/ended
   * -- filled in after the run from the sim circle-snapshot accumulator,
   * falling back to this row's own live snapshot when the player never
   * actually crossed into (or out of) this circle within the run (e.g. the
   * very last, incomplete circle). */
  beginCell: string;
  endCell: string;
}

interface CircleRow {
  circle: number;
  players: PlayerSnapshot[];
}

interface RunResult {
  playerColors: string[];
  winnerIndex: number;
  /** The winner's own final circle count -- may be less than another
   * player's if the winner simply had worse luck lapping the board. Rows
   * past this were only added because someone else kept circling; the
   * winner's own progress had already stopped (see the table's render). */
  winnerCircles: number;
  stopReason: HeadlessStopReason;
  turnsPlayed: number;
  settingSummary: string;
  rows: CircleRow[];
}

const numInput = (
  value: number,
  onChange: (n: number) => void,
  width = '4rem',
  step?: number
) => (
  <input
    type="number"
    min={0}
    step={step ?? 1}
    value={Number.isFinite(value) ? value : 0}
    style={{ width }}
    onChange={(e) => {
      const n = parseFloat(e.target.value);
      const clamped = Number.isNaN(n) ? 0 : Math.max(0, n);
      onChange(clamped);
    }}
  />
);

function snapshotPlayer(board: GameState, player: Player): PlayerSnapshot {
  const owned = board.tiles.filter((t) => t.owner === player.id);
  return {
    fame: player.fame,
    gold: player.gold,
    militia: player.militia,
    riders: player.riders,
    tilesOwned: owned.length,
    tileNames: owned.map((t) => t.shortName),
    wealth: totalWealth(board, player),
    artifactsEmoji: player.artifacts.map((id) => getArtifact(id)?.emoji ?? '').join(''),
    isPOW: player.isPrisonerOfWar,
    log: [],
    dailyIncome: { gold: 0, units: 0 },
    tileSequence: [],
    beginCell: '',
    endCell: '',
  };
}

/** "X🧍X🟡" for the daily-income summary -- null when there's nothing to
 * show, same zero-hiding rule as formatUnits. */
function formatIncomeSummary(gold: number, units: number): string | null {
  if (gold <= 0 && units <= 0) return null;
  const parts: string[] = [];
  if (units > 0) parts.push(`${units}🧍`);
  if (gold > 0) parts.push(`${gold}🟡`);
  return parts.join(' ');
}

const EconomySimScreen: React.FC = () => {
  const t = useT();
  const ov = getOverrides();

  const [tileBasePrice, setTileBasePrice] = useState(ov.tileBasePrice);
  const [tileIncomeMult, setTileIncomeMult] = useState(ov.tileIncomeMult);
  const [tileUpgradeMult, setTileUpgradeMult] = useState(ov.tileUpgradeMult);
  const [passStartGold, setPassStartGold] = useState(ov.moneyPassStart);
  const [passStartUnits, setPassStartUnits] = useState(ov.unitsPassStart);
  const [militiaPrice, setMilitiaPrice] = useState(ov.militiaPrice);
  const [riderPrice, setRiderPrice] = useState(ov.riderPrice);
  const [playerCount, setPlayerCount] = useState(2);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  // Safety net: if this screen ever disappears some other way than the
  // Close button below (e.g. a new screen replaces it outright), don't
  // leave the app stuck in the sim's pseudo-language. Only reverts if
  // still on 'sim' -- a manual language switch mid-run isn't clobbered.
  useEffect(() => {
    return () => {
      if (getLanguage() === 'sim') setLanguage('en');
    };
  }, []);

  const handleRun = () => {
    // Sim-tuned message text (sim.json), without touching en.json -- reverted
    // to 'en' when the screen closes (see the Close button below).
    setLanguage('sim');
    setRunning(true);
    // Deferred so "Simulating…" actually paints before the run blocks the thread.
    setTimeout(async () => {
      const settingSummary = t('economySimScreen.settingSummary', {
        tileBasePrice,
        tileIncomeMult,
        tileUpgradeMult,
        passStartGold,
        passStartUnits,
        militiaPrice,
        riderPrice,
        playerCount,
      });

      setHeadlessOverrides({
        tileBasePrice,
        tileIncomeMult,
        tileUpgradeMult,
        moneyPassStart: passStartGold,
        unitsPassStart: passStartUnits,
        militiaPrice,
        riderPrice,
      });

      const tiles = buildTilesFromTemplates(tilesData as TileJSON[]);
      const players = Array.from(
        { length: playerCount },
        (_, i) =>
          new Player({
            name: PLAYER_COLORS[i],
            color: PLAYER_COLORS[i],
            gold: 0,
            units: 0,
            position: 0,
            image: PLAYER_COLORS[i],
            isComputer: true,
            character: 'wizard',
            id: i + 1,
          })
      );
      const board = new GameState(tiles, players);
      board.playerOrder = players.map((_, i) => i);
      board.activePlayerIndex = 0;
      gameStart(board, () => {});

      const rows: CircleRow[] = [];
      let lastCircle = 0;
      const onTick = (b: GameState) => {
        const maxCircle = Math.max(...b.players.map((p) => p.circles));
        if (maxCircle > lastCircle) {
          lastCircle = maxCircle;
          rows.push({ circle: maxCircle, players: b.players.map((p) => snapshotPlayer(b, p)) });
        }
      };

      const runOutcome = await runHeadlessGame(board, onTick, { maxCircles: 50 });
      setHeadlessOverrides(null);

      // onTick only fires on a circle change, so the stop condition can fire
      // between ticks -- make sure the last row always reflects the true
      // final state rather than a possibly-stale earlier tick.
      const finalSnapshot = board.players.map((p) => snapshotPlayer(board, p));
      if (
        rows.length === 0 ||
        JSON.stringify(rows[rows.length - 1].players) !== JSON.stringify(finalSnapshot)
      ) {
        rows.push({ circle: lastCircle, players: finalSnapshot });
      }

      // Read the sim log/income only now they're complete -- a row's circle
      // is the max any player had reached, so a player still lapping behind
      // keeps adding to an earlier circle's totals well after that row was
      // captured.
      for (const row of rows) {
        row.players.forEach((snapshot, i) => {
          snapshot.log = getSimLog(players[i].id, row.circle);
          snapshot.dailyIncome = getSimIncome(players[i].id, row.circle);
          snapshot.tileSequence = getSimTileVisits(players[i].id, row.circle);
          const fallback = formatCellStats(snapshot);
          snapshot.beginCell = getSimCircleSnapshot(players[i].id, row.circle) ?? fallback;
          snapshot.endCell = getSimCircleSnapshot(players[i].id, row.circle + 1) ?? fallback;
        });
      }

      let winnerIndex = 0;
      if (runOutcome.stopReason === 'game-over') {
        // The dragon fight doesn't advance the turn on a win (see
        // driveOneTurn), so the active player is still whoever slew it.
        winnerIndex = board.players.findIndex((p) => p.id === board.activePlayer.id);
        if (winnerIndex < 0) winnerIndex = 0;
      } else {
        let bestWealth = -1;
        board.players.forEach((p, i) => {
          const w = totalWealth(board, p);
          if (w > bestWealth) {
            bestWealth = w;
            winnerIndex = i;
          }
        });
      }

      setResult({
        playerColors: players.map((p) => p.color),
        winnerIndex,
        winnerCircles: board.players[winnerIndex].circles,
        stopReason: runOutcome.stopReason,
        turnsPlayed: runOutcome.turnsPlayed,
        settingSummary,
        rows,
      });
      setRunning(false);
    }, 0);
  };

  return (
    <GameModal className="game-modal cheat-screen" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen">
        <div className="cheat-row">
          <label>🧩 {t('economySimScreen.tileBasePrice')}</label>
          {numInput(tileBasePrice, setTileBasePrice, '5rem', 10)}
        </div>
        <div className="cheat-row">
          <label>{t('economySimScreen.tileIncomeMult')}</label>
          {numInput(tileIncomeMult, setTileIncomeMult, '4rem', 0.1)}
          <label>{t('economySimScreen.tileUpgradeMult')}</label>
          {numInput(tileUpgradeMult, setTileUpgradeMult, '4rem', 0.1)}
        </div>
        <div className="cheat-row">
          <label>{t('economySimScreen.passStart')}</label>
          🟡 {numInput(passStartGold, setPassStartGold, '4rem', 10)}
          🧍 {numInput(passStartUnits, setPassStartUnits, '4rem')}
        </div>
        <div className="cheat-row">
          <label>{t('economySimScreen.unitPrices')}</label>
          🧍 {numInput(militiaPrice, setMilitiaPrice, '4rem', 10)}
          🐎 {numInput(riderPrice, setRiderPrice, '4rem', 10)}
        </div>
        <div className="cheat-row">
          <label>{t('economySimScreen.playerCount')}</label>
          <select value={playerCount} onChange={(e) => setPlayerCount(parseInt(e.target.value, 10))}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>

        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
          <DecoratedButton onClick={handleRun} disabled={running}>
            {running ? t('economySimScreen.simulating') : t('economySimScreen.simulate')}
          </DecoratedButton>
          {result && <DecoratedButton onClick={() => setResult(null)}>{t('battleSimScreen.clear')}</DecoratedButton>}
          <DecoratedButton
            onClick={() => {
              setLanguage('en');
              clearScreen();
            }}
          >
            {t('common.close')}
          </DecoratedButton>
        </div>

        {result && (
          <div>
            <p style={{ whiteSpace: 'pre-line', textAlign: 'center', color: 'white' }}>
              {result.settingSummary}
              <br />
              {t('economySimScreen.stopReason', {
                reason: t(`economySimScreen.stopReasonLabel.${result.stopReason}`),
                turns: result.turnsPlayed,
              })}
            </p>
            <div className="player-stats-container" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              <table className="player-stats-table">
                <thead>
                  <tr className="player-stats-header">
                    <th className="player-stats-header-cell">{t('economySimScreen.circle')}</th>
                    {result.playerColors.map((color, i) => (
                      <th key={i} className="player-stats-header-cell">
                        {PLAYER_SWATCH[color] ?? color} {color}
                        {i === result.winnerIndex ? ` 🥇${t('economySimScreen.winner')}` : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'player-stats-row' : 'player-stats-row-alt'}>
                      <td className="player-stats-cell">{row.circle}</td>
                      {row.players.map((p, j) => {
                        // The winner's own progress stopped at winnerCircles --
                        // a later row only exists because someone else kept
                        // lapping, so their cell here would just be a stale
                        // repeat of their final stats. Show the trophy instead.
                        if (j === result.winnerIndex && row.circle > result.winnerCircles) {
                          return (
                            <td
                              key={j}
                              className="player-stats-cell"
                              style={{ textAlign: 'center', fontSize: '2em' }}
                            >
                              🥇
                            </td>
                          );
                        }

                        const incomeSummary = formatIncomeSummary(p.dailyIncome.gold, p.dailyIncome.units);

                        return (
                          <td key={j} className="player-stats-cell" style={{ verticalAlign: 'top' }}>
                            <div style={{ whiteSpace: 'nowrap' }}>▶️ {p.beginCell}</div>
                            <div style={{ whiteSpace: 'nowrap' }}>⏹️ {p.endCell}</div>
                            {p.tileNames.length > 0 && (
                              <div style={{ fontSize: '0.75em', opacity: 0.75, marginTop: '4px', maxWidth: '22rem' }}>
                                🧩 {p.tileNames.join(', ')}
                              </div>
                            )}
                            {p.tileSequence.length > 0 && (
                              <div style={{ fontSize: '0.75em', opacity: 0.75, marginTop: '4px', maxWidth: '22rem' }}>
                                🚶 {p.tileSequence.join(' -> ')}
                              </div>
                            )}
                            {p.log.length > 0 && (
                              <div style={{ fontSize: '0.75em', opacity: 0.75, marginTop: '4px', maxWidth: '22rem' }}>
                                {p.log.map((line, k) => (
                                  <div key={k}>{line}</div>
                                ))}
                              </div>
                            )}
                            {incomeSummary && (
                              <div style={{ fontSize: '0.75em', opacity: 0.75, marginTop: '4px' }}>
                                {t('economySimScreen.fromDaily', { summary: incomeSummary })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </GameModal>
  );
};

export default EconomySimScreen;
