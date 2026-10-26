import { useEffect, useMemo, useState } from 'react';
import { planTomorrow } from '../lib/predict.js';
import { buildCoachScript, toScriptTxt, toNarration } from '../lib/script.js';
import { downloadFile } from '../lib/storage.js';
import MakeVideo from './MakeVideo.jsx';

export default function VideoView({ tasks, day, settings, setSettings, notify }) {
  const generated = useMemo(() => {
    const plan = planTomorrow(tasks, day);
    return toScriptTxt(buildCoachScript(tasks, day, plan, { lang: settings.lang, name: settings.name }));
  }, [tasks, day, settings.lang, settings.name]);

  // User script edit kar sakta hai; naya data aaye to fresh script
  const [text, setText] = useState(generated);
  useEffect(() => setText(generated), [generated]);

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
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
      <h2 id="vid-h">📖 Aaj ki <span className="grad-text">Story</span></h2>
      <p className="hint">Tumhare din ka chhota review + kal ka plan, ek click mein video bana do.</p>

      <MakeVideo
        title={lines[0] || 'Persona'}
        beats={lines.slice(1)}
        lang={settings.lang}
        day={day}
        notify={notify}
      />

      <div className="card form">
        <label>
          Tumhara naam (video mein)
          <input value={settings.name} maxLength={40} onChange={(e) => setSettings({ ...settings, name: e.target.value })} placeholder="optional" />
        </label>
        <label>
          Bhasha
          <select value={settings.lang} onChange={(e) => setSettings({ ...settings, lang: e.target.value })}>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <details className="card">
        <summary>✏️ Story padho / badlo <span className="muted">· ~{seconds} sec</span></summary>
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
