import { useRef, useState } from 'react';
import { LANGS } from '../lib/i18n.js';

export const APP_VERSION = '2.1.0';

/**
 * Settings: profile + bhasha, theme, data (backup/import/demo), app lock, about.
 * "Developer options" chhupe hain: version pe 5 baar tap karo (Android jaisa).
 */
export default function SettingsView({
  t, settings, setSettings, hasDemo, onToggleDemo, onBackup, onImport, onAbout, notify, lockSlot,
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
      notify(`${5 - n} â€¦`);
    }
  }

  const theme = settings.theme || 'light';
  const ACTS = [['less', 'ðŸŒ±', t('act_less')], ['medium', 'ðŸŒ¿', t('act_medium')], ['more', 'ðŸŒ³', t('act_more')]];

  return (
    <section aria-labelledby="set-h">
      <h2 id="set-h">âš™ï¸ {t('settings')}</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>ðŸ‘¤ {t('profile')}{settings.name ? `: ${settings.name}` : ''}</h3>
        <label className="block">
          {t('language')}
          <select value={settings.lang} onChange={(e) => setSettings({ ...settings, lang: e.target.value })}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name} Â· {l.en}</option>)}
          </select>
        </label>
        <fieldset className="seg" style={{ marginTop: 10 }}>
          <legend>{t('ob_activity')}</legend>
          {ACTS.map(([v, icon, label]) => (
            <label key={v} className={settings.activity === v ? 'chip on' : 'chip'}>
              <input type="radio" name="activity" checked={settings.activity === v} onChange={() => setSettings({ ...settings, activity: v })} />
              {icon} {label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="ghost sm" style={{ marginTop: 10 }} onClick={() => setSettings({ ...settings, onboarded: false })}>
          âœï¸ {t('edit_profile')}
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>ðŸŽ¨ {t('theme')}</h3>
        <fieldset className="seg">
          <legend className="sr-only">{t('theme')}</legend>
          {[['light', `â˜€ï¸ ${t('light')}`], ['dark', `ðŸŒ™ ${t('dark')}`]].map(([v, l]) => (
            <label key={v} className={theme === v ? 'chip on' : 'chip'}>
              <input type="radio" name="theme" value={v} checked={theme === v} onChange={() => setSettings({ ...settings, theme: v })} />
              {l}
            </label>
          ))}
        </fieldset>
      </div>

      {lockSlot}

      <div className="card settings-list">
        <h3 style={{ margin: 0 }}>ðŸ’¾ {t('data')}</h3>
        <p className="hint">{t('data_hint')}</p>
        <div className="row wrap">
          <button type="button" className="primary" onClick={onBackup}>ðŸ’¾ {t('backup')}</button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>ðŸ“¥ {t('import')}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport} aria-label={t('import')} />
        </div>
        <div className="row wrap">
          <button type="button" className="ghost" onClick={onToggleDemo}>
            {hasDemo ? `ðŸ§¹ ${t('demo_remove')}` : `ðŸ§ª ${t('demo_try')}`}
          </button>
        </div>
      </div>

      <div className="card settings-list">
        <button type="button" className="ghost" onClick={onAbout}>â„¹ï¸ {t('about')}</button>
        {settings.devMode && (
          <button type="button" className="ghost sm" onClick={() => { setSettings({ ...settings, devMode: false }); setTaps(0); notify('Developer options off'); }}>
            Developer options off
          </button>
        )}
      </div>

      <p style={{ textAlign: 'center' }}>
        <button type="button" className="version-tap" onClick={tapVersion} aria-label={`Version ${APP_VERSION}`}>
          Persona v{APP_VERSION}{settings.devMode ? ' Â· developer' : ''}
        </button>
      </p>
    </section>
  );
}
