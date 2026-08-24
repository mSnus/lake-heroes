import React, { useState } from 'react';
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
import { getSimLog } from '../utils/simLogStore';
import { clearScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

const PLAYER_COLORS = ['blue', 'red', 'green', 'yellow'];
const PLAYER_SWATCH: Record<string, string> = { blue: '🔵', red: '🔴', green: '🟢', yellow: '🟡' };

interface PlayerSnapshot {
  fame: number;
  gold: number;
  units: number;
  tilesOwned: number;
  wealth: number;
  artifactsEmoji: string;
  isPOW: boolean;
  /** What happened to this player during this circle -- filled in after the
   * run from the sim log (see attachLogs). */
  log: string[];
}

interface CircleRow {
  circle: number;
  players: PlayerSnapshot[];
}

interface RunResult {
  playerColors: string[];
  winnerIndex: number;
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
  const tilesOwned = board.tiles.filter((t) => t.owner === player.id).length;
  return {
    fame: player.fame,
    gold: player.gold,
    units: player.units,
    tilesOwned,
    wealth: totalWealth(board, player),
    artifactsEmoji: player.artifacts.map((id) => getArtifact(id)?.emoji ?? '').join(''),
    isPOW: player.isPrisonerOfWar,
    log: [],
  };
}

function formatCell(s: PlayerSnapshot): string {
  const pow = s.isPOW ? ' ⛓️' : '';
  return `${s.fame}🏆 ${s.gold}🟡 ${s.units}🧍 ${s.tilesOwned}🧩 🧮${s.wealth}${s.artifactsEmoji}${pow}`;
}

const EconomySimScreen: React.FC = () => {
  const t = useT();
  const ov = getOverrides();

  const [tileBasePrice, setTileBasePrice] = useState(ov.tileBasePrice);
  const [tileIncomeMult, setTileIncomeMult] = useState(ov.tileIncomeMult);
  const [tileUpgradeMult, setTileUpgradeMult] = useState(ov.tileUpgradeMult);
  const [passStartGold, setPassStartGold] = useState(ov.moneyPassStart);
  const [passStartUnits, setPassStartUnits] = useState(ov.unitsPassStart);
  const [playerCount, setPlayerCount] = useState(2);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const handleRun = () => {
    setRunning(true);
    // Deferred so "Simulating…" actually paints before the run blocks the thread.
    setTimeout(async () => {
      const settingSummary = t('economySimScreen.settingSummary', {
        tileBasePrice,
        tileIncomeMult,
        tileUpgradeMult,
        passStartGold,
        passStartUnits,
        playerCount,
      });

      setHeadlessOverrides({
        tileBasePrice,
        tileIncomeMult,
        tileUpgradeMult,
        moneyPassStart: passStartGold,
        unitsPassStart: passStartUnits,
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

      const runOutcome = await runHeadlessGame(board, onTick, { unitThreshold: 60, maxCircles: 50 });
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

      // Read the sim log only now it's complete -- a row's circle is the max
      // any player had reached, so a player still lapping behind keeps adding
      // to an earlier circle's log well after that row was captured.
      for (const row of rows) {
        row.players.forEach((snapshot, i) => {
          snapshot.log = getSimLog(players[i].id, row.circle);
        });
      }

      let winnerIndex = 0;
      if (runOutcome.stopReason === 'unit-threshold') {
        winnerIndex = board.players.findIndex((p) => p.units >= 60);
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
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>

        {result && (
          <div>
            <p style={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
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
                      {row.players.map((p, j) => (
                        <td key={j} className="player-stats-cell" style={{ verticalAlign: 'top' }}>
                          <div style={{ whiteSpace: 'nowrap' }}>{formatCell(p)}</div>
                          {p.log.length > 0 && (
                            <div style={{ fontSize: '0.75em', opacity: 0.75, marginTop: '4px', maxWidth: '22rem' }}>
                              {p.log.map((line, k) => (
                                <div key={k}>{line}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      ))}
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
