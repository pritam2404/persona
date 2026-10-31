import { useRef, useState } from 'react';
import { LANGS } from '../lib/i18n.js';
import { soundEngine } from '../utils/audio.ts';

export const APP_VERSION = '2.2.0';

/**
 * Settings: profile + bhasha, theme, night reminder, data (backup/import/demo), app lock, about.
 * "Developer options" chhupe hain: version pe 5 baar tap karo (Android jaisa).
 */
export default function SettingsView({
  t,
  settings,
  setSettings,
  hasDemo,
  onToggleDemo,
  onBackup,
  onImport,
  onAbout,
  notify,
  lockSlot,
  triggerTestReminder,
}) {
  const fileRef = useRef(null);
  const [taps, setTaps] = useState(0);

  function tapVersion() {
    if (settings.devMode) {
      notify('Developer options on');
      return;
    }
    const n = taps + 1;
    setTaps(n);
    if (n >= 5) {
      setSettings({ ...settings, devMode: true });
      notify('Developer options on (Story tab)');
    } else if (n >= 2) {
      notify(`${5 - n} …`);
    }
  }

  const theme = settings.theme || 'light';
  const ACTS = [
    ['less', '🌱', t('act_less')],
    ['medium', '🌿', t('act_medium')],
    ['more', '🌳', t('act_more')],
  ];

  return (
    <section aria-labelledby="set-h">
      <h2 id="set-h">⚙️ {t('settings')}</h2>

      {/* Profile */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>👤 {t('profile')}{settings.name ? `: ${settings.name}` : ''}</h3>
        <label className="block">
          {t('language')}
          <select value={settings.lang} onChange={(e) => setSettings({ ...settings, lang: e.target.value })}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} · {l.en}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="seg" style={{ marginTop: 10 }}>
          <legend>{t('ob_activity')}</legend>
          {ACTS.map(([v, icon, label]) => (
            <label key={v} className={settings.activity === v ? 'chip on' : 'chip'}>
              <input
                type="radio"
                name="activity"
                checked={settings.activity === v}
                onChange={() => setSettings({ ...settings, activity: v })}
              />
              {icon} {label}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="ghost sm"
          style={{ marginTop: 10 }}
          onClick={() => setSettings({ ...settings, onboarded: false })}
        >
          ✏️ {t('edit_profile')}
        </button>
      </div>

      {/* Theme */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>🎨 {t('theme')}</h3>
        <fieldset className="seg">
          <legend className="sr-only">{t('theme')}</legend>
          {[
            ['light', `☀️ ${t('light')}`],
            ['dark', `🌙 ${t('dark')}`],
          ].map(([v, l]) => (
            <label key={v} className={theme === v ? 'chip on' : 'chip'}>
              <input
                type="radio"
                name="theme"
                value={v}
                checked={theme === v}
                onChange={() => setSettings({ ...settings, theme: v })}
              />
              {l}
            </label>
          ))}
        </fieldset>
      </div>

      {/* Raat Ka Reminder Settings */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>🌙 {t('night_reminder_title')}</h3>
        <p className="hint" style={{ marginTop: 4 }}>
          {t('night_reminder_sub')}
        </p>

        <div className="row between" style={{ margin: '12px 0 8px' }}>
          <span>Raat Ka Reminder Alert</span>
          <label className="chip" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(settings.nightReminderEnabled)}
              onChange={(e) => setSettings({ ...settings, nightReminderEnabled: e.target.checked })}
            />
            {settings.nightReminderEnabled ? '✓ Chalu' : 'Band'}
          </label>
        </div>

        {settings.nightReminderEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <label className="block">
              <span>{t('night_reminder_time')}:</span>
              <input
                type="time"
                value={settings.nightReminderTime || '21:30'}
                onChange={(e) => setSettings({ ...settings, nightReminderTime: e.target.value })}
                style={{ width: 140 }}
              />
            </label>

            <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="ghost sm"
                onClick={() => {
                  soundEngine.playEveningChime(true);
                  if (triggerTestReminder) triggerTestReminder();
                  notify('🔔 Test reminder bajaya gaya!');
                }}
              >
                🔊 {t('night_reminder_test')}
              </button>
              {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <button
                  type="button"
                  className="ghost sm"
                  onClick={() => {
                    Notification.requestPermission().then((p) => {
                      if (p === 'granted') notify('Browser notification activate ho gaya');
                    });
                  }}
                >
                  🔔 Browser Push On Karein
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {lockSlot}

      {/* Data */}
      <div className="card settings-list">
        <h3 style={{ margin: 0 }}>💾 {t('data')}</h3>
        <p className="hint">{t('data_hint')}</p>
        <div className="row wrap">
          <button type="button" className="primary" onClick={onBackup}>💾 {t('backup')}</button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>📥 {t('import')}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport} aria-label={t('import')} />
        </div>
        <div className="row wrap">
          <button type="button" className="ghost" onClick={onToggleDemo}>
            {hasDemo ? `🧹 ${t('demo_remove')}` : `🧪 ${t('demo_try')}`}
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card settings-list">
        <button type="button" className="ghost" onClick={onAbout}>ℹ️ {t('about')}</button>
        {settings.devMode && (
          <button
            type="button"
            className="ghost sm"
            onClick={() => {
              setSettings({ ...settings, devMode: false });
              setTaps(0);
              notify('Developer options off');
            }}
          >
            Developer options off
          </button>
        )}
      </div>

      <p style={{ textAlign: 'center' }}>
        <button type="button" className="version-tap" onClick={tapVersion} aria-label={`Version ${APP_VERSION}`}>
          Persona v{APP_VERSION}{settings.devMode ? ' · developer' : ''}
        </button>
      </p>
    </section>
  );
}
