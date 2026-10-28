import { useState } from 'react';
import { validPin, enableLock, disableLock, unlock } from '../lib/lock.js';

/** Settings ka "App lock" card: chalu / PIN badlo / band */
export default function LockSettings({ t, enabled, tasks, onEnabled, onDisabled, notify }) {
  const [mode, setMode] = useState(null); // null | 'on' | 'change' | 'off'
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const digits = (setter) => (e) => setter(e.target.value.replace(/\D/g, '').slice(0, 6));
  function reset() { setMode(null); setCur(''); setP1(''); setP2(''); setErr(''); }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if ((mode === 'on' || mode === 'change') && !validPin(p1)) { setErr(t('lock_set')); return; }
    if ((mode === 'on' || mode === 'change') && p1 !== p2) { setErr(t('lock_mismatch')); return; }
    setBusy(true);
    try {
      if (mode === 'change' || mode === 'off') {
        await unlock(cur); // sirf check: abhi wala PIN sahi hai?
      }
      if (mode === 'off') {
        disableLock(tasks);
        onDisabled();
        notify(t('lock_off'));
      } else {
        const key = await enableLock(p1, tasks);
        onEnabled(key);
        notify(t('lock_enabled'));
      }
      reset();
    } catch (e2) {
      setErr(e2.wrong ? t('lock_wrong') : e2.wait ? t('lock_wait', e2.wait) : e2.message);
    } finally {
      setBusy(false);
    }
  }

  const pinInput = (label, value, setter, auto) => (
    <label className="block">
      {label}
      <input
        type="password"
        inputMode="numeric"
        autoComplete={auto}
        maxLength={6}
        value={value}
        onChange={digits(setter)}
      />
    </label>
  );

  return (
    <div className="card settings-list">
      <h3 style={{ margin: 0 }}>🔒 {t('lock_title')}{enabled ? ' ✅' : ''}</h3>
      <p className="hint">{t('lock_hint')}</p>

      {!mode && (
        <div className="row wrap">
          {!enabled && <button type="button" className="primary" onClick={() => setMode('on')}>{t('lock_on')}</button>}
          {enabled && <button type="button" className="ghost" onClick={() => setMode('change')}>{t('lock_change')}</button>}
          {enabled && <button type="button" className="ghost danger" onClick={() => setMode('off')}>{t('lock_off')}</button>}
        </div>
      )}

      {mode && (
        <form className="settings-list" onSubmit={submit}>
          {(mode === 'change' || mode === 'off') && pinInput(t('lock_current'), cur, setCur, 'current-password')}
          {mode !== 'off' && pinInput(t('lock_set'), p1, setP1, 'new-password')}
          {mode !== 'off' && pinInput(t('lock_confirm'), p2, setP2, 'new-password')}
          {err && <p className="errors" role="alert">{err}</p>}
          <div className="row wrap">
            <button type="submit" className="primary" disabled={busy}>{busy ? '…' : '✓ OK'}</button>
            <button type="button" className="ghost" onClick={reset}>{t('lock_cancel')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
