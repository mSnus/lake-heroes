import React, { useState } from 'react';
import { clearScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { runBattleSimulations, attackerLossPercentile, SimDefenderKind, SimResult } from '../game/battleGrid/simulate';
import { getOverrides } from '../utils/overridesStore';
import { DRAGON_HP, DRAGON_DMG_MIN, DRAGON_DMG_MAX } from '../game/constants';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

const PERCENTILES = [10, 20, 40, 50, 60, 80];

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

/** What the defender's hp/dmg fields reset to when the kind dropdown
 * changes -- the real effective stats for that kind today (zombie's
 * multipliers pre-applied, dragon's fixed constants), so switching kinds
 * always starts from an accurate baseline the user can then tweak. */
function defaultDefenderStats(kind: SimDefenderKind): { hp: number; dmgMin: number; dmgMax: number } {
  if (kind === 'dragon') return { hp: DRAGON_HP, dmgMin: DRAGON_DMG_MIN, dmgMax: DRAGON_DMG_MAX };
  const ov = getOverrides();
  if (kind === 'zombie') {
    return {
      hp: Math.round(ov.militiaHp * ov.zombieHpMult),
      dmgMin: Math.round(ov.militiaDmgMin * ov.zombieDmgMult),
      dmgMax: Math.round(ov.militiaDmgMax * ov.zombieDmgMult),
    };
  }
  return { hp: ov.militiaHp, dmgMin: ov.militiaDmgMin, dmgMax: ov.militiaDmgMax };
}

const BattleSimScreen: React.FC = () => {
  const t = useT();
  const ov = getOverrides();

  const [attackerMilitia, setAttackerMilitia] = useState(12);
  const [attackerRiders, setAttackerRiders] = useState(0);
  const [militiaHp, setMilitiaHp] = useState(ov.militiaHp);
  const [militiaDmgMin, setMilitiaDmgMin] = useState(ov.militiaDmgMin);
  const [militiaDmgMax, setMilitiaDmgMax] = useState(ov.militiaDmgMax);
  const [riderHp, setRiderHp] = useState(ov.riderHp);
  const [riderDmgMin, setRiderDmgMin] = useState(ov.riderDmgMin);
  const [riderDmgMax, setRiderDmgMax] = useState(ov.riderDmgMax);

  const [defenderAmount, setDefenderAmount] = useState(6);
  const [defenderKind, setDefenderKind] = useState<SimDefenderKind>('normal');
  const [defenderStats, setDefenderStats] = useState(() => defaultDefenderStats('normal'));
  const [defenderBonusPct, setDefenderBonusPct] = useState(0);

  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);

  const handleDefenderKindChange = (kind: SimDefenderKind) => {
    setDefenderKind(kind);
    setDefenderStats(defaultDefenderStats(kind));
  };

  const settingLabel = () =>
    `${attackerMilitia}🧍+${attackerRiders}🐎 ${t('common.vs')} ${defenderAmount}${KIND_EMOJI[defenderKind]}` +
    (defenderBonusPct > 0 ? ` +${defenderBonusPct}%` : '');

  const handleSimulate = () => {
    setRunning(true);
    // Deferred so the "Simulating…" label actually paints before the
    // (synchronous, CPU-bound) run blocks the thread.
    setTimeout(() => {
      const results: SimResult[] = runBattleSimulations(
        {
          militia: attackerMilitia,
          riders: attackerRiders,
          militiaHp,
          militiaDmgMin,
          militiaDmgMax,
          riderHp,
          riderDmgMin,
          riderDmgMax,
        },
        { amount: defenderAmount, kind: defenderKind, ...defenderStats },
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
        <div className="cheat-row">
          <label>⚔️ {t('battleSimScreen.attacker')}</label>
          🧍 {numInput(attackerMilitia, setAttackerMilitia)}
          🐎 {numInput(attackerRiders, setAttackerRiders)}
        </div>
        <div className="cheat-row">
          <label>🧍 {t('overridesScreen.militia')}</label>
          {numInput(militiaHp, setMilitiaHp)} {t('overridesScreen.hp')}
          {numInput(militiaDmgMin, setMilitiaDmgMin)}–{numInput(militiaDmgMax, setMilitiaDmgMax)} {t('overridesScreen.dmg')}
        </div>
        <div className="cheat-row">
          <label>🐎 {t('overridesScreen.rider')}</label>
          {numInput(riderHp, setRiderHp)} {t('overridesScreen.hp')}
          {numInput(riderDmgMin, setRiderDmgMin)}–{numInput(riderDmgMax, setRiderDmgMax)} {t('overridesScreen.dmg')}
        </div>

        <div className="cheat-row">
          <label>🛡️ {t('battleSimScreen.defender')}</label>
          {numInput(defenderAmount, setDefenderAmount)}
          <select value={defenderKind} onChange={(e) => handleDefenderKindChange(e.target.value as SimDefenderKind)}>
            <option value="normal">{KIND_EMOJI.normal}</option>
            <option value="zombie">{KIND_EMOJI.zombie}</option>
            <option value="dragon">{KIND_EMOJI.dragon}</option>
          </select>
        </div>
        <div className="cheat-row">
          {numInput(defenderStats.hp, (n) => setDefenderStats((s) => ({ ...s, hp: n })))} {t('overridesScreen.hp')}
          {numInput(defenderStats.dmgMin, (n) => setDefenderStats((s) => ({ ...s, dmgMin: n })))}–
          {numInput(defenderStats.dmgMax, (n) => setDefenderStats((s) => ({ ...s, dmgMax: n })))} {t('overridesScreen.dmg')}
        </div>
        <div className="cheat-row">
          <label>{t('battleSimScreen.bonus')}</label>
          <select value={defenderBonusPct} onChange={(e) => setDefenderBonusPct(parseInt(e.target.value, 10))}>
            <option value={0}>0%</option>
            <option value={10}>10%</option>
            <option value={20}>20%</option>
            <option value={30}>30%</option>
          </select>
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
