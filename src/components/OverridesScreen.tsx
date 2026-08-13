import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import { clearScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { GameOverrides, getOverrides, setOverrides, useOverrides } from '../utils/overridesStore';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/OverridesScreen.css';

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
      onChange(Number.isNaN(n) ? 0 : n);
    }}
  />
);

const OverridesScreen: React.FC<OverridesScreenProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const live = useOverrides();

  // Local, editable copy of every numeric field. Toggles read/write the live
  // store directly (they take effect the instant you flip them).
  const [form, setForm] = useState<GameOverrides>(() => ({ ...getOverrides() }));
  const set = (patch: Partial<GameOverrides>) => setForm((f) => ({ ...f, ...patch }));

  // Commit a subset (or everything) to the live store, then re-render the
  // board so repriced tiles / recomputed slots show immediately.
  const commit = (patch: Partial<GameOverrides>) => {
    setOverrides(patch);
    updateGameState(gameState);
  };

  const applyAll = () => {
    commit(form);
    clearScreen();
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen overrides-screen">
        <h2 className="game-title">⚖️ {t('overridesScreen.title')}</h2>

        <div className="cheat-row">
          <label>🧍 {t('overridesScreen.militia')}</label>
          {numInput(form.militiaHp, (n) => set({ militiaHp: n }))} {t('overridesScreen.hp')}
          {numInput(form.militiaDmgMin, (n) => set({ militiaDmgMin: n }))}–
          {numInput(form.militiaDmgMax, (n) => set({ militiaDmgMax: n }))} {t('overridesScreen.dmg')}
          {numInput(form.militiaPrice, (n) => set({ militiaPrice: n }), '3rem')}🟡
          <button
            className="game-menu-button"
            onClick={() => commit({ militiaHp: form.militiaHp, militiaDmgMin: form.militiaDmgMin, militiaDmgMax: form.militiaDmgMax, militiaPrice: form.militiaPrice })}
          >
            {t('overridesScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>🐎 {t('overridesScreen.rider')}</label>
          {numInput(form.riderHp, (n) => set({ riderHp: n }))} {t('overridesScreen.hp')}
          {numInput(form.riderDmgMin, (n) => set({ riderDmgMin: n }))}–
          {numInput(form.riderDmgMax, (n) => set({ riderDmgMax: n }))} {t('overridesScreen.dmg')}
          {numInput(form.riderPrice, (n) => set({ riderPrice: n }), '3rem')}🟡
          <button
            className="game-menu-button"
            onClick={() => commit({ riderHp: form.riderHp, riderDmgMin: form.riderDmgMin, riderDmgMax: form.riderDmgMax, riderPrice: form.riderPrice })}
          >
            {t('overridesScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>🏯 {t('overridesScreen.garrisonCapacity')}</label>
          {numInput(form.garrisonCapacity, (n) => set({ garrisonCapacity: n }))}
          <button className="game-menu-button" onClick={() => commit({ garrisonCapacity: form.garrisonCapacity })}>
            {t('overridesScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.tileBasePrice')}</label>
          {numInput(form.tileBasePrice, (n) => set({ tileBasePrice: n }), '3rem')}
          <button className="game-menu-button" onClick={() => commit({ tileBasePrice: form.tileBasePrice })}>
            {t('overridesScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.tileUpgradeMult')}</label>
          {numInput(form.tileUpgradeMult, (n) => set({ tileUpgradeMult: n }))}×
          <button className="game-menu-button" onClick={() => commit({ tileUpgradeMult: form.tileUpgradeMult })}>
            {t('overridesScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('overridesScreen.tileIncomeMult')}</label>
          {numInput(form.tileIncomeMult, (n) => set({ tileIncomeMult: n }))}×
          <button className="game-menu-button" onClick={() => commit({ tileIncomeMult: form.tileIncomeMult })}>
            {t('overridesScreen.set')}
          </button>
        </div>

        <div className="cheat-row overrides-toggle">
          <label>{t('overridesScreen.stepByStep')}</label>
          <input
            type="checkbox"
            checked={live.stepByStepCombat}
            onChange={(e) => commit({ stepByStepCombat: e.target.checked })}
          />
        </div>

        <div className="cheat-row overrides-toggle">
          <label>{t('overridesScreen.muteToasts')}</label>
          <input
            type="checkbox"
            checked={live.muteToasts}
            onChange={(e) => commit({ muteToasts: e.target.checked })}
          />
        </div>

        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <DecoratedButton onClick={applyAll}>{t('overridesScreen.apply')}</DecoratedButton>
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default OverridesScreen;
