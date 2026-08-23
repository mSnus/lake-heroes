import React, { useState, useEffect } from 'react';
import { clearScreen, showScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { runBattleSimulations, attackerLossPercentile, lightLossRate, SimDefenderKind, SimResult } from '../game/battleGrid/simulate';
import { getOverrides } from '../utils/overridesStore';
import { DRAGON_HP, DRAGON_DMG_MIN, DRAGON_DMG_MAX } from '../game/constants';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { BattleScreen } from './BattleScreen';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

// The <20% column is computed separately (see lightLossRate), not a raw
// percentile -- kept out of this list, and spliced into the table between
// the 40% and 10% columns.
const PERCENTILES = [80, 60, 50, 40, 10];

interface ResultRow {
  label: React.ReactNode;
  percentiles: number[];
  lightLossPct: number;
}

const numInput = (value: number, onChange: (n: number) => void, width = '3.2rem', disabled = false) => (
  <input
    type="number"
    min={0}
    value={Number.isFinite(value) ? value : 0}
    disabled={disabled}
    style={{ width, opacity: disabled ? 0.5 : 1 }}
    onChange={(e) => {
      const n = parseInt(e.target.value, 10);
      const clamped = Number.isNaN(n) ? 0 : Math.max(0, n);
      // If the parsed value didn't change (e.g. a leading zero typed in
      // front of an existing digit), React bails out of re-rendering since
      // the state is unchanged, leaving the stray zero in the DOM -- write
      // the trimmed text back directly so it never lingers.
      e.target.value = String(clamped);
      onChange(clamped);
    }}
  />
);

const KIND_EMOJI: Record<SimDefenderKind, string> = {
  normal: '🧍',
  zombie: '🧟‍♀️',
  dragon: '🐉',
};

/** What the defender's hp/dmg fields reset to when the kind dropdown
 * changes -- dragon is a fixed monster, unrelated to militia/rider stats;
 * zombie is the *current* militia row's hp/dmg (whatever's typed above
 * right now, not the Overrides screen's saved defaults) times the global
 * zombie multipliers, so switching kinds always starts from an accurate
 * baseline the user can then tweak further. */
function defaultDefenderStats(
  kind: SimDefenderKind,
  militiaHp: number,
  militiaDmgMin: number,
  militiaDmgMax: number
): { hp: number; dmgMin: number; dmgMax: number } {
  if (kind === 'dragon') return { hp: DRAGON_HP, dmgMin: DRAGON_DMG_MIN, dmgMax: DRAGON_DMG_MAX };
  if (kind === 'zombie') {
    const ov = getOverrides();
    return {
      hp: Math.round(militiaHp * ov.zombieHpMult),
      dmgMin: Math.round(militiaDmgMin * ov.zombieDmgMult),
      dmgMax: Math.round(militiaDmgMax * ov.zombieDmgMult),
    };
  }
  return { hp: militiaHp, dmgMin: militiaDmgMin, dmgMax: militiaDmgMax };
}

/** Persists the form (and results) across the screen closing and reopening
 * -- e.g. after "Run battle" hands off to the battle screen and back --
 * since the component itself unmounts each time the screen is cleared. */
interface SimFormState {
  attackerMilitia: number;
  attackerRiders: number;
  militiaHp: number;
  militiaDmgMin: number;
  militiaDmgMax: number;
  riderHp: number;
  riderDmgMin: number;
  riderDmgMax: number;
  defenderAmount: number;
  defenderKind: SimDefenderKind;
  defenderStats: { hp: number; dmgMin: number; dmgMax: number };
  defenderBonusPct: number;
  rows: ResultRow[];
}
let savedFormState: SimFormState | null = null;

const BattleSimScreen: React.FC = () => {
  const t = useT();
  const ov = getOverrides();

  const [attackerMilitia, setAttackerMilitia] = useState(savedFormState?.attackerMilitia ?? 12);
  const [attackerRiders, setAttackerRiders] = useState(savedFormState?.attackerRiders ?? 0);
  const [militiaHp, setMilitiaHp] = useState(savedFormState?.militiaHp ?? ov.militiaHp);
  const [militiaDmgMin, setMilitiaDmgMin] = useState(savedFormState?.militiaDmgMin ?? ov.militiaDmgMin);
  const [militiaDmgMax, setMilitiaDmgMax] = useState(savedFormState?.militiaDmgMax ?? ov.militiaDmgMax);
  const [riderHp, setRiderHp] = useState(savedFormState?.riderHp ?? ov.riderHp);
  const [riderDmgMin, setRiderDmgMin] = useState(savedFormState?.riderDmgMin ?? ov.riderDmgMin);
  const [riderDmgMax, setRiderDmgMax] = useState(savedFormState?.riderDmgMax ?? ov.riderDmgMax);

  const [defenderAmount, setDefenderAmount] = useState(savedFormState?.defenderAmount ?? 6);
  const [defenderKind, setDefenderKind] = useState<SimDefenderKind>(savedFormState?.defenderKind ?? 'normal');
  const [defenderStats, setDefenderStats] = useState(
    () => savedFormState?.defenderStats ?? defaultDefenderStats('normal', ov.militiaHp, ov.militiaDmgMin, ov.militiaDmgMax)
  );
  const [defenderBonusPct, setDefenderBonusPct] = useState(savedFormState?.defenderBonusPct ?? 0);

  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>(savedFormState?.rows ?? []);

  // Keep the module-level snapshot current, so a remount (e.g. after "Run
  // battle" closes) can restore exactly where things were left.
  useEffect(() => {
    savedFormState = {
      attackerMilitia, attackerRiders, militiaHp, militiaDmgMin, militiaDmgMax,
      riderHp, riderDmgMin, riderDmgMax, defenderAmount, defenderKind, defenderStats,
      defenderBonusPct, rows,
    };
  });

  const handleDefenderKindChange = (kind: SimDefenderKind) => {
    setDefenderKind(kind);
    setDefenderStats(defaultDefenderStats(kind, militiaHp, militiaDmgMin, militiaDmgMax));
  };

  // Headcounts (no per-side emoji, just the numbers) + defender kind emoji
  // -- omitted for 'normal', since that's just plain militia, same as the
  // attacker's own -- then one line per attacker tier actually in play,
  // showing that tier's hp/dmg so two rows with the same headcounts but
  // different stats don't look identical.
  const settingLabel = (): React.ReactNode => {
    const defenderEmoji = defenderKind === 'normal' ? '' : KIND_EMOJI[defenderKind];
    const lines: string[] = [`${attackerMilitia}+${attackerRiders} ${t('common.vs')} ${defenderAmount}${defenderEmoji}`];
    if (attackerMilitia > 0) lines.push(`🧍${militiaHp}/${militiaDmgMin}-${militiaDmgMax}`);
    if (attackerRiders > 0) lines.push(`🐎${riderHp}/${riderDmgMin}-${riderDmgMax}`);
    return lines.map((line, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {line}
      </React.Fragment>
    ));
  };

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
      const lightLossPct = lightLossRate(results);
      setRows((prev) => [{ label: settingLabel(), percentiles, lightLossPct }, ...prev]);
      setRunning(false);
    }, 0);
  };

  // Opens the real battle screen (full UI/animation) for a single run of the
  // exact setting currently configured, using synthetic throwaway Player/
  // GameState objects so nothing about the real game is touched.
  const handleRunBattle = () => {
    const atkPlayer = new Player({ name: t('battleSimScreen.attacker'), color: 'red', gold: 0, units: attackerMilitia, position: -1, image: 'red', isComputer: true });
    atkPlayer.riders = attackerRiders;
    const defPlayer = new Player({ name: t('battleSimScreen.defender'), color: 'blue', gold: 0, units: 0, position: -1, image: 'blue', isComputer: true });
    if (defenderKind === 'dragon') defPlayer.riders = defenderAmount;
    else defPlayer.militia = defenderAmount;
    const battleGameState = new GameState([], [atkPlayer, defPlayer]);

    showScreen({
      content: (
        <BattleScreen
          attacker={atkPlayer}
          gameState={battleGameState}
          updateGameState={() => {}}
          mode="player"
          defender={defPlayer}
          battlefieldUnits={Math.min(atkPlayer.units, defPlayer.units)}
          onClose={() => showScreen({ content: <BattleSimScreen /> })}
          statOverrides={{
            attackerMilitiaHp: militiaHp,
            attackerMilitiaDmgMin: militiaDmgMin,
            attackerMilitiaDmgMax: militiaDmgMax,
            attackerRiderHp: riderHp,
            attackerRiderDmgMin: riderDmgMin,
            attackerRiderDmgMax: riderDmgMax,
            defenderKind,
            defenderHp: defenderKind === 'normal' ? militiaHp : defenderStats.hp,
            defenderDmgMin: defenderKind === 'normal' ? militiaDmgMin : defenderStats.dmgMin,
            defenderDmgMax: defenderKind === 'normal' ? militiaDmgMax : defenderStats.dmgMax,
            defenderPctBonus: defenderBonusPct / 100,
          }}
        />
      ),
    });
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
          {/* A 'normal' defender is genuinely the same militia kind as the
              attacker's own -- these inputs are disabled and show the
              attacker's live militia stats instead, since that's what a
              normal-defender battle actually uses (see simulate.ts). */}
          {numInput(
            defenderKind === 'normal' ? militiaHp : defenderStats.hp,
            (n) => setDefenderStats((s) => ({ ...s, hp: n })),
            '3.2rem',
            defenderKind === 'normal'
          )}{' '}
          {t('overridesScreen.hp')}
          {numInput(
            defenderKind === 'normal' ? militiaDmgMin : defenderStats.dmgMin,
            (n) => setDefenderStats((s) => ({ ...s, dmgMin: n })),
            '3.2rem',
            defenderKind === 'normal'
          )}
          –
          {numInput(
            defenderKind === 'normal' ? militiaDmgMax : defenderStats.dmgMax,
            (n) => setDefenderStats((s) => ({ ...s, dmgMax: n })),
            '3.2rem',
            defenderKind === 'normal'
          )}{' '}
          {t('overridesScreen.dmg')}
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
          <DecoratedButton onClick={handleRunBattle}>{t('battleSimScreen.runBattle')}</DecoratedButton>
          {rows.length > 0 && (
            <DecoratedButton onClick={() => setRows([])}>{t('battleSimScreen.clear')}</DecoratedButton>
          )}
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>

        {rows.length > 0 && (
          <div className="player-stats-container" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
            <table className="player-stats-table">
              <thead>
                <tr className="player-stats-header">
                  <th className="player-stats-header-cell">{t('battleSimScreen.setting')}</th>
                  {PERCENTILES.slice(0, -1).map((p) => (
                    <th key={p} className="player-stats-header-cell">{p}%</th>
                  ))}
                  <th className="player-stats-header-cell">&lt;20%</th>
                  <th className="player-stats-header-cell">{PERCENTILES[PERCENTILES.length - 1]}%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'player-stats-row' : 'player-stats-row-alt'}>
                    <td className="player-stats-cell" style={{ whiteSpace: 'nowrap' }}>{r.label}</td>
                    {r.percentiles.slice(0, -1).map((v, j) => (
                      <td key={j} className="player-stats-cell">{v}</td>
                    ))}
                    <td className="player-stats-cell">{r.lightLossPct}%</td>
                    <td className="player-stats-cell">{r.percentiles[r.percentiles.length - 1]}</td>
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
