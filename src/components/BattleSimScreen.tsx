import React, { useState } from 'react';
import { clearScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { runBattleSimulations, attackerLossPercentile, SimDefenderKind, SimResult } from '../game/battleGrid/simulate';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

const PERCENTILES = [10, 20, 40, 60, 80];

interface ResultRow {
  label: string;
  percentiles: number[];
}

const numInput = (value: number, onChange: (n: number) => void, width = '3.2rem') => (
  <input
    type="number"
    min={0}
    value={Number.isFinite(value) ? value : 0}
    style={{ width }}
    onChange={(e) => {
      const n = parseInt(e.target.value, 10);
      onChange(Number.isNaN(n) ? 0 : Math.max(0, n));
    }}
  />
);

const KIND_EMOJI: Record<SimDefenderKind, string> = {
  normal: '🧍',
  zombie: '🧟‍♀️',
  dragon: '🐉',
};

const BattleSimScreen: React.FC = () => {
  const t = useT();

  const [attackerMilitia, setAttackerMilitia] = useState(12);
  const [attackerRiders, setAttackerRiders] = useState(0);
  const [defenderAmount, setDefenderAmount] = useState(6);
  const [defenderKind, setDefenderKind] = useState<SimDefenderKind>('normal');
  const [defenderBonusPct, setDefenderBonusPct] = useState(0);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);

  const settingLabel = () =>
    `${attackerMilitia}🧍+${attackerRiders}🐎 ${t('common.vs')} ${defenderAmount}${KIND_EMOJI[defenderKind]}` +
    (defenderBonusPct > 0 ? ` +${defenderBonusPct}%` : '');

  const handleSimulate = () => {
    setRunning(true);
    // Deferred so the "Simulating…" label actually paints before the
    // (synchronous, CPU-bound) run blocks the thread.
    setTimeout(() => {
      const results: SimResult[] = runBattleSimulations(
        { militia: attackerMilitia, riders: attackerRiders },
        { amount: defenderAmount, kind: defenderKind },
        defenderBonusPct / 100,
        100
      );
      const percentiles = PERCENTILES.map((p) => attackerLossPercentile(results, p));
      setRows((prev) => [{ label: settingLabel(), percentiles }, ...prev]);
      setRunning(false);
    }, 0);
  };

  return (
    <GameModal className="game-modal cheat-screen" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen">
        <h2 className="game-title">🤼 {t('battleSimScreen.title')}</h2>

        <div className="cheat-row">
          <label>⚔️ {t('battleSimScreen.attacker')}</label>
          🧍 {numInput(attackerMilitia, setAttackerMilitia)}
          🐎 {numInput(attackerRiders, setAttackerRiders)}
        </div>

        <div className="cheat-row">
          <label>🛡️ {t('battleSimScreen.defender')}</label>
          {numInput(defenderAmount, setDefenderAmount)}
          <select value={defenderKind} onChange={(e) => setDefenderKind(e.target.value as SimDefenderKind)}>
            <option value="normal">{t('battleSimScreen.normal')}</option>
            <option value="zombie">{t('battleSimScreen.zombie')}</option>
            <option value="dragon">{t('battleSimScreen.dragon')}</option>
          </select>
        </div>

        <div className="cheat-row">
          <label>{t('battleSimScreen.bonus')}</label>
          {[0, 10, 20, 30].map((pct) => (
            <label key={pct} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                name="defenderBonusPct"
                checked={defenderBonusPct === pct}
                onChange={() => setDefenderBonusPct(pct)}
              />
              {pct}%
            </label>
          ))}
        </div>

        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
          <DecoratedButton onClick={handleSimulate} disabled={running}>
            {running ? t('battleSimScreen.simulating') : t('battleSimScreen.simulate')}
          </DecoratedButton>
          {rows.length > 0 && (
            <DecoratedButton onClick={() => setRows([])}>{t('battleSimScreen.clear')}</DecoratedButton>
          )}
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>

        {rows.length > 0 && (
          <div className="player-stats-container">
            <table className="player-stats-table">
              <thead>
                <tr className="player-stats-header">
                  <th className="player-stats-header-cell">{t('battleSimScreen.setting')}</th>
                  {PERCENTILES.map((p) => (
                    <th key={p} className="player-stats-header-cell">{p}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'player-stats-row' : 'player-stats-row-alt'}>
                    <td className="player-stats-cell">{r.label}</td>
                    {r.percentiles.map((v, j) => (
                      <td key={j} className="player-stats-cell">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GameModal>
  );
};

export default BattleSimScreen;
