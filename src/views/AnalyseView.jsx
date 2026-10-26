import { useState } from 'react';
import { lastNDays, summarize, energyByHour, insights, distinctDays } from '../lib/analyze.js';
import { fmtDuration } from '../lib/time.js';

/** Energy ka rang + shabd (sirf rang pe depend nahi - colour-blind users ke liye shabd bhi) */
function energyLevel(avg) {
  if (avg < 2.5) return { cls: 'low', word: 'kam' };
  if (avg < 3.5) return { cls: 'mid', word: 'theek' };
  return { cls: 'high', word: 'high' };
}

function Bar({ label, value, max, text, tone }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track" aria-hidden="true">
        <span className={tone ? `bar-fill ${tone}` : 'bar-fill'} style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-val">{text}</span>
    </div>
  );
}

export default function AnalyseView({ tasks, day }) {
  const [range, setRange] = useState(14);
  const list = lastNDays(tasks, day, range);
  const s = summarize(list);
  const nDays = distinctDays(list);
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 0;
  const energy = energyByHour(list);
  const ins = insights(tasks, day, range);

  return (
    <section aria-labelledby="an-h">
      <div className="row between">
        <h2 id="an-h">Analysis</h2>
        <label>
          <span className="sr-only">Range</span>
          <select value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={7}>Pichhle 7 din</option>
            <option value={14}>Pichhle 14 din</option>
            <option value={30}>Pichhle 30 din</option>
          </select>
        </label>
      </div>

      {!list.length ? (
        <p className="muted">Is range mein data nahi hai. "Aaj" tab mein tasks log karo.</p>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><span className="num">{nDays}</span><span>din</span></div>
            <div className="stat"><span className="num">{s.count}</span><span>tasks</span></div>
            <div className="stat"><span className="num">{Math.round(s.doneRate * 100)}%</span><span>poore</span></div>
            <div className="stat"><span className="num">{Math.round(s.skipRate * 100)}%</span><span>skip</span></div>
          </div>

          <h3>Kya seekha (insights)</h3>
          {ins.length ? (
            <ul className="insights">
              {ins.map((i) => (
                <li key={i.kind + i.text} className="card">
                  <p>{i.text}</p>
                  <p className="why">Kyun: {i.why}</p>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Abhi koi pattern nahi.</p>}

          <h3>Time kahan gaya</h3>
          <div className="card">
            <Bar label="Office" value={s.byArea.office || 0} max={Math.max(s.byArea.office || 0, s.byArea.personal || 0)} text={fmtDuration(s.byArea.office || 0)} />
            <Bar label="Personal" value={s.byArea.personal || 0} max={Math.max(s.byArea.office || 0, s.byArea.personal || 0)} text={fmtDuration(s.byArea.personal || 0)} />
            <hr />
            {cats.map(([c, m]) => <Bar key={c} label={c} value={m} max={maxCat} text={fmtDuration(m)} />)}
          </div>

          <h3>Energy - ghante ke hisaab se</h3>
          <div className="card">
            {energy.map((e) => {
              const lv = energyLevel(e.avg);
              return (
                <Bar
                  key={e.hour}
                  label={`${String(e.hour).padStart(2, '0')}:00`}
                  value={e.avg}
                  max={5}
                  tone={lv.cls}
                  text={`${e.avg.toFixed(1)} ${lv.word}`}
                />
              );
            })}
            <p className="hint">
              <span className="dot high" /> high (3.5+) &nbsp; <span className="dot mid" /> theek &nbsp; <span className="dot low" /> kam (2.5 se neeche).
              {' '}Har ghante ka average un tasks se jo us ghante shuru hue. Kam tasks = kam bharosa.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
