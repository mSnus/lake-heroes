import React, { useState, useEffect } from 'react';
import { clearScreen, showScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { runBattleSimulations, attackerLossPercentile, SimDefenderKind, SimResult } from '../game/battleGrid/simulate';
import { getOverrides } from '../utils/overridesStore';
import { DRAGON_HP, DRAGON_DMG_MIN, DRAGON_DMG_MAX, DRAGON_UNITS } from '../game/constants';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { BattleScreen } from './BattleScreen';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

// Every cell is a share of the attacker's own army, not a unit count, so
// runs of different sizes stay comparable. The trailing "<20%" column is
// the 20th and 10th percentiles averaged into one best-case figure, so
// neither needs a column of its own.
const PERCENTILES = [80, 60, 50, 40];
const LOW_PERCENTILES = [20, 10];

interface ResultRow {
  label: React.ReactNode;
  /** Attacker losses at each of PERCENTILES, as a % of its army size. */
  percentiles: number[];
  /** LOW_PERCENTILES averaged, same units. */
  lowPct: number;
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

// The two battle artifacts, in the order getArtifactRollBonus checks them.
// Each is worth +1 to every attacker roll, and +2 more against the Dragon.
const BATTLE_ARTIFACTS = ['broken-blade', 'dwemer-axe'];
const artifactFlatBonus = (count: number, vsDragon: boolean): number => count * (vsDragon ? 3 : 1);

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
      hp: ov.zombieHp,
      dmgMin: ov.zombieDmgMin,
      dmgMax: ov.zombieDmgMax,
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
  artifactCount: number;
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
  const [artifactCount, setArtifactCount] = useState(savedFormState?.artifactCount ?? 0);

  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>(savedFormState?.rows ?? []);

  // Keep the module-level snapshot current, so a remount (e.g. after "Run
  // battle" closes) can restore exactly where things were left.
  useEffect(() => {
    savedFormState = {
      attackerMilitia, attackerRiders, militiaHp, militiaDmgMin, militiaDmgMax,
      riderHp, riderDmgMin, riderDmgMax, defenderAmount, defenderKind, defenderStats,
      defenderBonusPct, artifactCount, rows,
    };
  });

  const handleDefenderKindChange = (kind: SimDefenderKind) => {
    setDefenderKind(kind);
    setDefenderStats(defaultDefenderStats(kind, militiaHp, militiaDmgMin, militiaDmgMax));
    // Start a dragon fight at the real encounter's headcount -- just a
    // starting point now, the field is editable and is what actually fights.
    if (kind === 'dragon') setDefenderAmount(DRAGON_UNITS);
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
    if (defenderKind !== 'normal') {
      lines.push(`${KIND_EMOJI[defenderKind]}${defenderStats.hp}/${defenderStats.dmgMin}-${defenderStats.dmgMax}`);
    }
    if (artifactCount > 0) lines.push(`${'🗡️'.repeat(artifactCount)}+${artifactFlatBonus(artifactCount, defenderKind === 'dragon')}`);
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
          flatBonus: artifactFlatBonus(artifactCount, defenderKind === 'dragon'),
        },
        { amount: defenderAmount, kind: defenderKind, ...defenderStats },
        defenderBonusPct / 100,
        100
      );
      // Every run in a batch fields the same army, so any result's total works.
      const armySize = results[0]?.attackerTotal || 1;
      const pctOfArmy = (lost: number) => Math.round((lost / armySize) * 100);
      const percentiles = PERCENTILES.map((p) => pctOfArmy(attackerLossPercentile(results, p)));
      const lowPct = pctOfArmy(
        LOW_PERCENTILES.reduce((sum, p) => sum + attackerLossPercentile(results, p), 0) / LOW_PERCENTILES.length
      );
      setRows((prev) => [{ label: settingLabel(), percentiles, lowPct }, ...prev]);
      setRunning(false);
    }, 0);
  };

  // Opens the real battle screen (full UI/animation) for a single run of the
  // exact setting currently configured, using synthetic throwaway Player/
  // GameState objects so nothing about the real game is touched.
  const handleRunBattle = () => {
    // Blue attacker / red defender, matching the battlefield grid's own
    // fixed per-side unit colours (see BattlefieldGrid.css) -- otherwise the
    // header portraits read the opposite way round from the units below.
    const atkPlayer = new Player({ name: t('battleSimScreen.attacker'), color: 'blue', gold: 0, units: attackerMilitia, position: -1, image: 'blue', isComputer: true });
    atkPlayer.riders = attackerRiders;
    atkPlayer.artifacts = BATTLE_ARTIFACTS.slice(0, artifactCount);
    const defPlayer = new Player({ name: t('battleSimScreen.defender'), color: 'red', gold: 0, units: 0, position: -1, image: 'red', isComputer: true });
    // Dragons occupy the rider slot (that's how createBattle builds them as
    // their own kind), at whatever headcount the amount field says -- they
    // line up in a normal grouped formation now, so any count works.
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
          {/* Small values on purpose: the bonus lifts every roll the defending
              side makes, and damage is the difference of two similar rolls, so
              it swings the outcome far harder than the number suggests -- 10%
              already flips an even fight to a near-certain defender win. These
              four span the whole usable range. */}
          <select value={defenderBonusPct} onChange={(e) => setDefenderBonusPct(parseInt(e.target.value, 10))}>
            <option value={0}>0%</option>
            <option value={2}>2%</option>
            <option value={4}>4%</option>
            <option value={6}>6%</option>
          </select>
        </div>
        <div className="cheat-row">
          <label>🗡️ {t('battleSimScreen.artifacts')}</label>
          <select value={artifactCount} onChange={(e) => setArtifactCount(parseInt(e.target.value, 10))}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
          +{artifactFlatBonus(artifactCount, defenderKind === 'dragon')}
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
                  {PERCENTILES.map((p) => (
                    <th key={p} className="player-stats-header-cell">{p}%</th>
                  ))}
                  <th className="player-stats-header-cell">&lt;20%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'player-stats-row' : 'player-stats-row-alt'}>
                    <td className="player-stats-cell" style={{ whiteSpace: 'nowrap' }}>{r.label}</td>
                    {r.percentiles.map((v, j) => (
                      <td key={j} className="player-stats-cell">{v}%</td>
                    ))}
                    <td className="player-stats-cell">{r.lowPct}%</td>
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
