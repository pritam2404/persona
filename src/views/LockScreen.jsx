import { useEffect, useRef, useState } from 'react';
import { unlock, resetEverything, lockoutSeconds } from '../lib/lock.js';

/** App kholte hi PIN. Number pad phone ke liye, keyboard bhi chalta hai. */
export default function LockScreen({ t, onUnlocked }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(() => lockoutSeconds());
  const inputRef = useRef(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setInterval(() => setWait(lockoutSeconds()), 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function submit(value = pin) {
    if (busy || wait > 0 || value.length < 4) return;
    setBusy(true);
    setErr('');
    try {
      const { key, tasks } = await unlock(value);
      onUnlocked(key, tasks);
    } catch (e) {
      setPin('');
      if (e.wait) setWait(e.wait);
      setErr(e.wrong ? t('lock_wrong') : e.wait ? t('lock_wait', e.wait) : e.message);
    } finally {
      setBusy(false);
    }
  }

  function press(d) {
    if (busy || wait > 0) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
    setErr('');
  }

  async function forgot() {
    if (!window.confirm(t('lock_reset_warn'))) return;
    await resetEverything();
    window.location.reload();
  }

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  return (
    <div className="ob lock" role="dialog" aria-modal="true" aria-labelledby="lock-h">
      <form className="ob-card lock-card" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <img src="./icon-192.png" alt="" className="lock-logo" />
        <h2 id="lock-h">🔒 {t('lock_enter')}</h2>

        <div className={err ? 'pin-dots shake' : 'pin-dots'} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        <label className="sr-only" htmlFor="pin-input">{t('lock_enter')}</label>
        <input
          id="pin-input"
          ref={inputRef}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={busy || wait > 0}
        />

        <p className="lock-msg" role="alert">
          {wait > 0 ? t('lock_wait', wait) : err}
        </p>

        <div className="keypad">
          {KEYS.map((k) => {
            if (k === 'del') {
              return <button key={k} type="button" className="key ghost" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">⌫</button>;
            }
            if (k === 'ok') {
              return (
                <button key={k} type="submit" className="key primary" disabled={busy || wait > 0 || pin.length < 4} aria-label={t('lock_unlock')}>
                  {busy ? '…' : '✓'}
                </button>
              );
            }
            return <button key={k} type="button" className="key ghost" onClick={() => press(k)}>{k}</button>;
          })}
        </div>

        <button type="button" className="link-btn lock-forgot" onClick={forgot}>{t('lock_forgot')}</button>
      </form>
    </div>
  );
}
