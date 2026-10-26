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
      <h2 id="vid-h">Coach video</h2>

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

      <label className="block">
        Script (edit kar sakte ho) <span className="muted">· line 1 = title, har line = ek scene · ~{seconds}s</span>
        <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <p className="hint">Office aur private tasks ke naam script mein automatically chhupe hote hain. Edit karte waqt khud naam mat daalna.</p>

      <div className="row wrap">
        <button type="button" className="primary" onClick={() => downloadFile(`coach-${day}.txt`, text + '\n', 'text/plain;charset=utf-8')}>
          Script download (.txt)
        </button>
        <button type="button" className="ghost" onClick={copyNarration}>Narration copy</button>
        <button type="button" className="ghost" onClick={() => setText(generated)}>Reset</button>
      </div>

      <MakeVideo
        title={lines[0] || 'Persona'}
        beats={lines.slice(1)}
        lang={settings.lang}
        day={day}
        notify={notify}
      />

      <details className="card">
        <summary>Advanced: laptop pe Python / lip-sync</summary>
        <p className="hint">
          Zaroorat nahi hai, upar wala button kaafi hai. Hoth hilne wala (lip-sync) video chahiye to:
          script download karo, <code>video\make_coach_video.py</code> se <code>voice.mp3</code> banao,
          phir <code>video\persona_lipsync_colab.ipynb</code> Google Colab pe chalao.
        </p>
      </details>
    </section>
  );
}
