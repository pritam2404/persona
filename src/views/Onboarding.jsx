import { useState } from 'react';
import { LANGS, makeT } from '../lib/i18n.js';

/**
 * Pehli baar app kholne pe 4 chhoti screens: bhasha -> naam -> umar/gender (optional) -> activeness.
 * Sab kuch sirf is phone mein save hota hai.
 */
export default function Onboarding({ settings, onDone }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState({
    lang: settings.lang || 'hi',
    name: settings.name || '',
    age: settings.age || '',
    sex: settings.sex || '',
    activity: settings.activity || 'medium',
  });
  const t = makeT(d.lang);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const last = 3;

  function finish() {
    const age = Number(d.age);
    onDone({
      ...d,
      name: d.name.trim().slice(0, 40),
      age: Number.isInteger(age) && age >= 5 && age <= 120 ? age : '',
      onboarded: true,
    });
  }

  const ACTS = [
    ['less', '🌱', t('act_less'), t('act_less_d')],
    ['medium', '🌿', t('act_medium'), t('act_medium_d')],
    ['more', '🌳', t('act_more'), t('act_more_d')],
  ];
  const SEX = [['female', t('female')], ['male', t('male')], ['other', t('other')], ['', t('no_say')]];

  return (
    <div className="ob" role="dialog" aria-modal="true" aria-labelledby="ob-h">
      <div className="ob-card">
        <div className="ob-dots" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
        </div>

        {step === 0 && (
          <>
            <div className="ob-emoji" aria-hidden="true">🌐</div>
            <h2 id="ob-h">{t('ob_lang')}</h2>
            <div className="lang-grid" role="radiogroup" aria-label={t('ob_lang')}>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={d.lang === l.code}
                  className={d.lang === l.code ? 'lang-btn on' : 'lang-btn'}
                  onClick={() => set('lang', l.code)}
                >
                  <span className="lang-native">{l.name}</span>
                  <span className="lang-en">{l.en}</span>
                </button>
              ))}
            </div>
            <p className="hint">{t('ob_lang_note')}</p>
          </>
        )}

        {step === 1 && (
          <>
            <div className="ob-emoji" aria-hidden="true">👋</div>
            <h2 id="ob-h">{t('ob_welcome')}</h2>
            <p className="muted">{t('ob_welcome_sub')}</p>
            <label className="block" style={{ marginTop: 12 }}>
              {t('ob_name')}
              <input
                value={d.name}
                maxLength={40}
                autoComplete="given-name"
                placeholder={t('ob_name_ph')}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
            <p className="hint">🔒 {t('ob_privacy')}</p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-emoji" aria-hidden="true">🙂</div>
            <h2 id="ob-h">{t('ob_age')}</h2>
            <input
              type="number"
              inputMode="numeric"
              min="5"
              max="120"
              value={d.age}
              onChange={(e) => set('age', e.target.value)}
              aria-label={t('ob_age')}
              style={{ width: '100%' }}
            />
            <fieldset className="seg" style={{ marginTop: 14 }}>
              <legend>{t('ob_sex')}</legend>
              {SEX.map(([v, l]) => (
                <label key={v || 'none'} className={d.sex === v ? 'chip on' : 'chip'}>
                  <input type="radio" name="sex" checked={d.sex === v} onChange={() => set('sex', v)} />
                  {l}
                </label>
              ))}
            </fieldset>
            <p className="hint">{t('ob_about_hint')}</p>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-emoji" aria-hidden="true">⚡</div>
            <h2 id="ob-h">{t('ob_activity')}</h2>
            <div className="act-list" role="radiogroup" aria-label={t('ob_activity')}>
              {ACTS.map(([v, icon, title, desc]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={d.activity === v}
                  className={d.activity === v ? 'act-btn on' : 'act-btn'}
                  onClick={() => set('activity', v)}
                >
                  <span className="act-icon" aria-hidden="true">{icon}</span>
                  <span>
                    <strong>{title}</strong>
                    <span className="hint" style={{ display: 'block', margin: 0 }}>{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="row between ob-nav">
          {step > 0 ? (
            <button type="button" className="ghost" onClick={() => setStep(step - 1)}>{t('back')}</button>
          ) : <span />}
          {step < last ? (
            <button type="button" className="primary" onClick={() => setStep(step + 1)}>
              {step === 0 ? t('ob_start') : t('next')} →
            </button>
          ) : (
            <button type="button" className="primary" onClick={finish}>{t('ob_done')} ✨</button>
          )}
        </div>
      </div>
    </div>
  );
}
