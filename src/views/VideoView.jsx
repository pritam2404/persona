import { useEffect, useMemo, useState } from 'react';
import { planTomorrow } from '../lib/predict.js';
import { buildCoachScript, toScriptTxt, toNarration, SCRIPT_LANGS } from '../lib/script.js';
import { downloadFile } from '../lib/storage.js';
import { LANGS } from '../lib/i18n.js';
import { voiceLangFor } from '../lib/voices.js';
import MakeVideo from './MakeVideo.jsx';

const toLines = (txt) => txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

export default function VideoView({ tasks, day, settings, setSettings, notify, t }) {
  const pick = settings.storyLang || settings.lang;
  const storyLang = SCRIPT_LANGS.includes(pick) ? pick : 'hi';
  const voiceLang = voiceLangFor(storyLang);

  const { generated, generatedEn } = useMemo(() => {
    const plan = planTomorrow(tasks, day);
    const opts = { name: settings.name };
    return {
      generated: toScriptTxt(buildCoachScript(tasks, day, plan, { ...opts, lang: storyLang })),
      generatedEn: toScriptTxt(buildCoachScript(tasks, day, plan, { ...opts, lang: 'en' })),
    };
  }, [tasks, day, storyLang, settings.name]);

  // User script edit kar sakta hai; naya data aaye to fresh script
  const [text, setText] = useState(generated);
  useEffect(() => setText(generated), [generated]);

  let lines = toLines(text);
  // Is bhasha ki awaaz nahi (pa/kn/ta): captions apni bhasha mein, awaaz English story bolegi.
  // Har line ka English jod chahiye - user ne lines badli to dono English (warna mismatch).
  let spoken = null;
  let fallbackNote = '';
  if (voiceLang !== storyLang) {
    const en = toLines(generatedEn);
    if (en.length === lines.length) {
      spoken = en.slice(1);
      fallbackNote = t('voice_fallback');
    } else {
      lines = en;
      fallbackNote = `${t('voice_fallback')} (English)`;
    }
  }
  const narration = toNarration({ beats: lines.slice(1) });
  const words = narration.split(/\s+/).filter(Boolean).length;
  const seconds = Math.round(words / 2.3); // ~140 shabd/minute

  async function copyNarration() {
    try {
      await navigator.clipboard.writeText(narration);
      notify('Narration copy hua');
    } catch {
      notify('Copy nahi hua - text select karke copy karo');
    }
  }

  return (
    <section aria-labelledby="vid-h">
      <h2 id="vid-h">📖 <span className="grad-text">{t('story_title')}</span></h2>
      <p className="hint">{t('story_sub')}</p>

      <MakeVideo
        t={t}
        title={lines[0] || 'Persona'}
        beats={lines.slice(1)}
        spoken={spoken}
        lang={storyLang}
        voiceLang={voiceLang}
        sex={settings.sex}
        day={day}
        notify={notify}
      />
      {fallbackNote && <p className="hint nudge">🔈 {fallbackNote}</p>}

      <div className="card form">
        <label>
          {t('your_name_video')}
          <input value={settings.name} maxLength={40} onChange={(e) => setSettings({ ...settings, name: e.target.value })} placeholder="optional" />
        </label>
        <label>
          {t('story_lang')}
          <select value={storyLang} onChange={(e) => setSettings({ ...settings, storyLang: e.target.value })}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
      </div>

      <details className="card">
        <summary>✏️ {t('edit_story')} <span className="muted">· ~{seconds} sec</span></summary>
        <label className="block" style={{ marginTop: 8 }}>
          <span className="hint">Pehli line = title, har agli line = video ka ek scene.</span>
          <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <p className="hint">Office aur private kaam ke naam story mein apne aap chhupe rehte hain. Badalte waqt khud mat likhna.</p>
        <div className="row wrap">
          <button type="button" className="ghost sm" onClick={copyNarration}>Copy</button>
          <button type="button" className="ghost sm" onClick={() => setText(generated)}>Reset</button>
        </div>
      </details>

      {settings.devMode && (
        <div className="card dev-card">
          <h3 style={{ marginTop: 0 }}>🛠️ Developer options</h3>
          <p className="hint">
            Laptop pe Python video / lip-sync ke liye. Story .txt download karo,{' '}
            <code>video\make_coach_video.py</code> se <code>voice.mp3</code> banao, phir{' '}
            <code>video\persona_lipsync_colab.ipynb</code> Google Colab pe chalao.
          </p>
          <button type="button" className="ghost" onClick={() => downloadFile(`coach-${day}.txt`, text + '\n', 'text/plain;charset=utf-8')}>
            ⬇ Story .txt download
          </button>
        </div>
      )}
    </section>
  );
}
