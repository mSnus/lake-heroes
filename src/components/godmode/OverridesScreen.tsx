import React, { useState } from 'react';
import { GameState } from '../../game/GameState';
import { clearScreen } from '../../utils/screenStore';
import { DecoratedButton } from '../ui/DecoratedButton';
import { GameOverrides, getOverrides, setOverrides, resetOverrides } from '../../utils/overridesStore';
import { useT } from '../../i18n';
import GameModal from '../screens/GameModal';
import '../../styles/modal.css';
import '../../styles/CheatScreen.css';
import '../../styles/OverridesScreen.css';

interface OverridesScreenProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

const numInput = (value: number, onChange: (n: number) => void, width = '1.6rem') => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    style={{ width }}
    onChange={(e) => {
      const n = parseFloat(e.target.value);
      const value = Number.isNaN(n) ? 0 : n;
      // If the parsed value didn't change (e.g. a leading zero typed in
      // front of an existing digit), React bails out of re-rendering since
      // the state is unchanged, leaving the stray zero in the DOM -- write
      // the trimmed text back directly so it never lingers.
      e.target.value = String(value);
      onChange(value);
    }}
  />
);

const OverridesScreen: React.FC<OverridesScreenProps> = ({ gameState, updateGameState }) => {
  const t = useT();

  // Local, editable draft of every field, toggles included -- nothing
  // reaches the live store until Apply. (Toggles used to write straight to
  // the live store on every click, which meant this draft's own stale
  // initial value for them would silently overwrite that change the next
  // time Apply ran for anything else.)
  const [form, setForm] = useState<GameOverrides>(() => ({ ...getOverrides() }));
  const set = (patch: Partial<GameOverrides>) => setForm((f) => ({ ...f, ...patch }));

  // Commit the whole draft to the live store, then re-render the board so
  // repriced tiles / recomputed slots show immediately.
  const applyAll = () => {
    setOverrides(form);
    updateGameState(gameState);
    clearScreen();
  };

  // Overrides persist to localStorage across reloads (that's the point --
  // a mid-game tweak should survive), which also means a stale saved value
  // silently outlives a constants.ts change until something clears it. This
  // is the only way to pick that up without starting a whole new game (the
  // other place resetOverrides() runs, see ShieldColumn.tsx).
  const resetToDefaults = () => {
    resetOverrides();
    setForm({ ...getOverrides() });
    updateGameState(gameState);
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen overrides-screen">
        <h2 className="game-title">⚖️ {t('overridesScreen.title')}</h2>

        <div className="cheat-row">
          <label>🧍</label>
          {numInput(form.militiaHp, (n) => set({ militiaHp: n }))} {t('overridesScreen.hp')}
          {numInput(form.militiaDmgMin, (n) => set({ militiaDmgMin: n }))}–
          {numInput(form.militiaDmgMax, (n) => set({ militiaDmgMax: n }))} {t('overridesScreen.dmg')}
          {numInput(form.militiaPrice, (n) => set({ militiaPrice: n }), '3rem')}🟡
          {numInput(form.militiaFood, (n) => set({ militiaFood: n }), '3rem')}🫓
          {numInput(form.militiaArms, (n) => set({ militiaArms: n }), '3rem')}⚔️
        </div>

        <div className="cheat-row">
          <label>🐎</label>
          {numInput(form.riderHp, (n) => set({ riderHp: n }))} {t('overridesScreen.hp')}
          {numInput(form.riderDmgMin, (n) => set({ riderDmgMin: n }))}–
          {numInput(form.riderDmgMax, (n) => set({ riderDmgMax: n }))} {t('overridesScreen.dmg')}
          {numInput(form.riderPrice, (n) => set({ riderPrice: n }), '3rem')}🟡
          {numInput(form.riderFood, (n) => set({ riderFood: n }), '3rem')}🫓
          {numInput(form.riderArms, (n) => set({ riderArms: n }), '3rem')}⚔️
        </div>

        <div className="cheat-row">
          <label>🧟‍♀️</label>
          {numInput(form.zombieHp, (n) => set({ zombieHp: n }))} {t('overridesScreen.hp')}
          {numInput(form.zombieDmgMin, (n) => set({ zombieDmgMin: n }))}–
          {numInput(form.zombieDmgMax, (n) => set({ zombieDmgMax: n }))} {t('overridesScreen.dmg')}
        </div>

        <div className="cheat-row">
          <label>🏯 {t('overridesScreen.garrisonSlotCapacity')}</label>
          {numInput(form.garrisonSlotCapacity, (n) => set({ garrisonSlotCapacity: n }))}
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.passStart')}</label>
          🟡{numInput(form.moneyPassStart, (n) => set({ moneyPassStart: n }), '3rem')}
          🧍{numInput(form.unitsPassStart, (n) => set({ unitsPassStart: n }))}
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.tileBasePrice')}</label>
          {numInput(form.tileBasePrice, (n) => set({ tileBasePrice: n }), '3rem')}
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.tileUpgradeMult')}</label>
          {numInput(form.tileUpgradeMult, (n) => set({ tileUpgradeMult: n }))}×
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.tileIncomeMult')}</label>
          {numInput(form.tileIncomeMult, (n) => set({ tileIncomeMult: n }))}×
        </div>

        <div className="cheat-row overrides-toggle">
          <label>{t('overridesScreen.stepByStep')}</label>
          <input
            type="checkbox"
            checked={form.stepByStepCombat}
            onChange={(e) => set({ stepByStepCombat: e.target.checked })}
          />
        </div>

        <div className="cheat-row overrides-toggle">
          <label>{t('overridesScreen.muteToasts')}</label>
          <input
            type="checkbox"
            checked={form.muteToasts}
            onChange={(e) => set({ muteToasts: e.target.checked })}
          />
        </div>

        <div className="cheat-row overrides-toggle">
          <label>{t('overridesScreen.headlessCombats')}</label>
          <input
            type="checkbox"
            checked={form.headlessCombats}
            onChange={(e) => set({ headlessCombats: e.target.checked })}
          />
        </div>

        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <DecoratedButton onClick={applyAll}>{t('overridesScreen.apply')}</DecoratedButton>
          <DecoratedButton onClick={resetToDefaults}>{t('overridesScreen.resetDefaults')}</DecoratedButton>
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default OverridesScreen;
