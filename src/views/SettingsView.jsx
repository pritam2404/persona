import { useRef, useState } from 'react';

export const APP_VERSION = '1.4.0';

/**
 * Settings: theme, demo data, backup/import, about.
 * "Developer options" chhupe hain: version pe 5 baar tap karo (Android jaisa).
 */
export default function SettingsView({ settings, setSettings, hasDemo, onToggleDemo, onBackup, onImport, onAbout, notify }) {
  const fileRef = useRef(null);
  const [taps, setTaps] = useState(0);

  function tapVersion() {
    if (settings.devMode) {
      notify('Developer options pehle se on hain');
      return;
    }
    const n = taps + 1;
    setTaps(n);
    if (n >= 5) {
      setSettings({ ...settings, devMode: true });
      notify('Developer options on ho gaye (Story tab mein dikhenge)');
    } else if (n >= 2) {
      notify(`Developer banne mein ${5 - n} tap baaki`);
    }
  }

  const theme = settings.theme || 'light';

  return (
    <section aria-labelledby="set-h">
      <h2 id="set-h">Settings</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Theme</h3>
        <fieldset className="seg">
          <legend className="sr-only">Theme chuno</legend>
          {[['light', '☀️ Light'], ['dark', '🌙 Dark']].map(([v, l]) => (
            <label key={v} className={theme === v ? 'chip on' : 'chip'}>
              <input type="radio" name="theme" value={v} checked={theme === v} onChange={() => setSettings({ ...settings, theme: v })} />
              {l}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="card settings-list">
        <h3 style={{ margin: 0 }}>Data</h3>
        <p className="hint">Data sirf is device pe hai. Doosre device pe: Backup → WhatsApp/Drive → wahan Import.</p>
        <div className="row wrap">
          <button type="button" className="primary" onClick={onBackup}>💾 Backup</button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>📥 Import</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport} aria-label="Backup file import karo" />
        </div>
        <div className="row wrap">
          <button type="button" className="ghost" onClick={onToggleDemo}>
            {hasDemo ? '🧹 Demo data hatao' : '🧪 Demo data try karo'}
          </button>
        </div>
      </div>

      <div className="card settings-list">
        <button type="button" className="ghost" onClick={onAbout}>ℹ️ About · Made by Pritam</button>
        {settings.devMode && (
          <button type="button" className="ghost sm" onClick={() => { setSettings({ ...settings, devMode: false }); setTaps(0); notify('Developer options band'); }}>
            Developer options band karo
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
