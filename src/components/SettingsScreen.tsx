import React from 'react';
import { clearScreen } from '../utils/screenStore';
import { DecoratedButton } from './DecoratedButton';
import { setSettings, useSettings } from '../utils/settingsStore';
import { LANGUAGES, setLanguage, useLanguage, Language, useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';
import '../styles/SettingsScreen.css';

const SettingsScreen: React.FC = () => {
  const t = useT();
  const settings = useSettings();
  const language = useLanguage();

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen settings-screen">
        <h2 className="game-title">⚙️ {t('settingsScreen.title')}</h2>

        <div className="settings-field">
          <label>{t('common.language')}</label>
          <select
            className="settings-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-toggle-label">
            <input
              type="checkbox"
              checked={settings.autoEndTurn}
              onChange={(e) => setSettings({ autoEndTurn: e.target.checked })}
            />
            {t('settingsScreen.autoEndTurn')}
          </label>
          <span className="settings-hint">{t('settingsScreen.autoEndTurnHint')}</span>
        </div>

        <div className="settings-field">
          <label className="settings-toggle-label">
            <input
              type="checkbox"
              checked={settings.autoBattle}
              onChange={(e) => setSettings({ autoBattle: e.target.checked })}
            />
            {t('settingsScreen.autoBattle')}
          </label>
          <span className="settings-hint">{t('settingsScreen.autoBattleHint')}</span>
        </div>

        <div className="settings-field">
          <label className="settings-toggle-label">
            <input
              type="checkbox"
              checked={settings.doNotDisplayBattles}
              onChange={(e) => setSettings({ doNotDisplayBattles: e.target.checked })}
            />
            {t('settingsScreen.doNotDisplayBattles')}
          </label>
          <span className="settings-hint">{t('settingsScreen.doNotDisplayBattlesHint')}</span>
        </div>

        <div className="settings-field">
          <label className="settings-toggle-label">
            <input
              type="checkbox"
              checked={settings.mapAutoZoom}
              onChange={(e) => setSettings({ mapAutoZoom: e.target.checked })}
            />
            {t('settingsScreen.mapAutoZoom')}
          </label>
          <span className="settings-hint">{t('settingsScreen.mapAutoZoomHint')}</span>
        </div>

        <div className="settings-field">
          <label className="settings-toggle-label">
            <input
              type="checkbox"
              checked={!settings.disableFog}
              onChange={(e) => setSettings({ disableFog: !e.target.checked })}
            />
            {t('settingsScreen.fogEffect')}
          </label>
          <span className="settings-hint">{t('settingsScreen.fogEffectHint')}</span>
        </div>

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}
        >
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default SettingsScreen;
