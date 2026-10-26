import { useRef, useState } from 'react';
import { CATEGORIES, normalizeTask, validateTask, mergeTasks } from '../lib/model.js';
import { tasksOn, summarize, findGaps, recentTemplates, lowEnergyHint, lastNDays } from '../lib/analyze.js';

// Chips pe chhota, samajh aane wala naam (data mein original English naam hi save hota hai)
const CATEGORY_LABEL = {
  'Deep work': 'Deep work 🎯',
  Study: 'Study 📚',
  Meetings: 'Meeting 👥',
  Admin: 'Mail/Admin ✉️',
  Health: 'Health 🏃',
  Family: 'Family 🏠',
  'Side project': 'Side project 🚀',
  Chores: 'Ghar ka kaam 🧺',
  Break: 'Break ☕',
  Other: 'Other',
};
import { durationMin, fmtDuration, addDays, toMin } from '../lib/time.js';

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function minusMin(hhmm, n) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h * 60 + m - n + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Default: pichhla task jahan khatam hua wahan se, warna "abhi se 30 min pehle".
 *  (Pehle default 09:00 tha -> raat ko save karne pe 14 ghante ka task ban jaata tha.) */
function defaultStart(lastEnd, end) {
  if (lastEnd && lastEnd < end && toMin(end) - toMin(lastEnd) <= 4 * 60) return lastEnd;
  return minusMin(end, 30);
}

function emptyForm(day, lastEnd) {
  const end = nowHHMM();
  return {
    id: '', date: day, title: '', area: 'personal', category: 'Other',
    start: defaultStart(lastEnd, end), end, estMin: '', energy: 3,
    status: 'done', note: '', private: false,
  };
}

const STATUS_LABEL = { done: 'Ho gaya', partial: 'Adhoora', skipped: 'Skip' };

export default function LogView({ tasks, setTasks, day, setDay, notify }) {
  const todays = tasksOn(tasks, day);
  const lastEnd = todays.length ? todays[todays.length - 1].end : '';
  const [form, setForm] = useState(() => emptyForm(day, lastEnd));
  const [errors, setErrors] = useState([]);
  const titleRef = useRef(null);
  const recents = recentTemplates(tasks);
  const gaps = findGaps(todays);
  const actualMin = durationMin(form.start, form.end);
  const focusHint = lowEnergyHint(lastNDays(tasks, day, 14), form.category, form.start);

  /** Haal ka kaam ek tap mein: naam/area/category bhar do, time wahi rehne do */
  function applyTemplate(tp) {
    setForm((f) => ({
      ...f,
      title: tp.title,
      area: tp.area,
      category: tp.category,
      private: tp.private,
      estMin: tp.estMin ?? '',
    }));
    setErrors([]);
  }

  /** Khaali time pe tap -> form mein wahi start/end, bas naam likhna baaki */
  function fillGap(g) {
    setForm({ ...emptyForm(day, ''), start: g.start, end: g.end });
    setErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => titleRef.current?.focus(), 300);
  }

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  function changeDay(next) {
    setDay(next);
    const list = tasksOn(tasks, next);
    setForm(emptyForm(next, list.length ? list[list.length - 1].end : ''));
    setErrors([]);
  }

  function submit(e) {
    e.preventDefault();
    const t = normalizeTask({ ...form, date: day });
    const errs = validateTask(t);
    setErrors(errs);
    if (errs.length) return;
    const mins = durationMin(t.start, t.end);
    if (mins > 6 * 60 && !window.confirm(`Ye task ${fmtDuration(mins)} ka hai. Start/End sahi hai?`)) return;
    setTasks((prev) => mergeTasks(prev, [t]));
    notify(form.id ? 'Task update hua' : 'Task save hua');
    setForm(emptyForm(day, t.end));
  }

  function edit(t) {
    setForm({ ...t, estMin: t.estMin ?? '' });
    setErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remove(t) {
    if (!window.confirm(`"${t.title}" delete karein?`)) return;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    notify('Task delete hua');
  }

  const s = summarize(todays);

  return (
    <section aria-labelledby="log-h">
      <div className="day-bar">
        <button type="button" className="ghost" onClick={() => changeDay(addDays(day, -1))} aria-label="Pichhla din">‹</button>
        <label className="day-pick">
          <span className="sr-only">Din chuno</span>
          <input type="date" value={day} onChange={(e) => e.target.value && changeDay(e.target.value)} />
        </label>
        <button type="button" className="ghost" onClick={() => changeDay(addDays(day, 1))} aria-label="Agla din">›</button>
      </div>

      {gaps.length > 0 && (
        <div className="card gap-card" role="region" aria-label="Log nahi hua time">
          <strong>Ye time log nahi hua</strong>
          <p className="hint">Is din ke tasks ke beech khaali time. Tap karke bharo (ya ignore karo).</p>
          <div className="row wrap">
            {gaps.map((g) => (
              <button key={g.start} type="button" className="ghost sm" onClick={() => fillGap(g)}>
                {g.start}–{g.end} · {fmtDuration(g.min)}
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 id="log-h">{form.id ? 'Task edit karo' : 'Naya task'}</h2>

      {!form.id && recents.length > 0 && (
        <div className="recents" role="group" aria-label="Haal ke kaam - ek tap mein bharo">
          <span className="hint">Haal ke kaam (tap = bhar do):</span>
          <div className="row wrap">
            {recents.map((tp) => (
              <button
                key={tp.title}
                type="button"
                className={form.title === tp.title ? 'chip on' : 'chip'}
                onClick={() => applyTemplate(tp)}
              >
                {tp.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="card form" onSubmit={submit} noValidate>
        <label className="full">
          Kya kiya?
          <input ref={titleRef} value={form.title} onChange={set('title')} placeholder="jaise: Audit queue, Gym, Python practice" maxLength={120} required />
        </label>

        <fieldset className="seg full">
          <legend>Area</legend>
          {['personal', 'office'].map((a) => (
            <label key={a} className={form.area === a ? 'chip on' : 'chip'}>
              <input type="radio" name="area" value={a} checked={form.area === a} onChange={set('area')} />
              {a === 'personal' ? 'Personal' : 'Office'}
            </label>
          ))}
        </fieldset>

        <fieldset className="seg full">
          <legend>Category</legend>
          {CATEGORIES.map((c) => (
            <label key={c} className={form.category === c ? 'chip on' : 'chip'}>
              <input type="radio" name="category" value={c} checked={form.category === c} onChange={set('category')} />
              {CATEGORY_LABEL[c] || c}
            </label>
          ))}
        </fieldset>

        <label>
          Start
          <input type="time" value={form.start} onChange={set('start')} required />
        </label>
        <label>
          End
          <input type="time" value={form.end} onChange={set('end')} required />
        </label>
        <label className="full">
          Shuru karne se pehle socha tha kitna time lagega? (min)
          <input type="number" min="1" max="1440" inputMode="numeric" value={form.estMin} onChange={set('estMin')} placeholder="optional, jaise 30" />
          <span className="hint">
            Asli time app khud Start-End se nikaalta hai{actualMin > 0 ? ` (abhi: ${fmtDuration(actualMin)})` : ''}. Ye sirf tumhara andaaza hai.
          </span>
        </label>

        {focusHint && (
          <p className="hint full nudge" role="note">⚡ {focusHint}</p>
        )}

        <label className="full">
          Energy: {form.energy}/5
          <input type="range" min="1" max="5" step="1" value={form.energy} onChange={set('energy')} aria-valuetext={`${form.energy} out of 5`} />
          <span className="hint">1 = thaka hua, 5 = full focus</span>
        </label>

        <fieldset className="seg full">
          <legend>Status</legend>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <label key={k} className={form.status === k ? 'chip on' : 'chip'}>
              <input type="radio" name="status" value={k} checked={form.status === k} onChange={set('status')} />
              {v}
            </label>
          ))}
        </fieldset>

        <label className="full">
          Note
          <input value={form.note} onChange={set('note')} placeholder="kya rukawat aayi? (optional)" maxLength={500} />
        </label>

        {form.area === 'personal' && (
          <label className="check full">
            <input type="checkbox" checked={form.private} onChange={set('private')} />
            Private - video script mein naam mat dikhana
          </label>
        )}
        {form.area === 'office' && (
          <p className="hint full">Office task ka naam video script mein kabhi nahi jaata.</p>
        )}

        {errors.length > 0 && (
          <ul className="errors full" role="alert">
            {errors.map((er) => <li key={er}>{er}</li>)}
          </ul>
        )}

        <div className="row full">
          <button type="submit" className="primary">{form.id ? 'Update' : 'Save'}</button>
          {form.id && (
            <button type="button" className="ghost" onClick={() => setForm(emptyForm(day, lastEnd))}>Cancel</button>
          )}
        </div>
      </form>

      <h2>
        Is din ke tasks <span className="muted">({s.count} · {fmtDuration(s.totalMin)})</span>
      </h2>
      {todays.length === 0 ? (
        <p className="muted">Abhi koi task nahi. Upar se pehla task likho, ya "Demo data" try karo.</p>
      ) : (
        <ul className="list">
          {todays.map((t) => (
            <li key={t.id} className={`item ${t.status}`}>
              <div className="item-main">
                <strong>{t.title}</strong>
                <span className="muted">
                  {t.start}–{t.end} · {fmtDuration(durationMin(t.start, t.end))} · {t.category} · energy {t.energy}
                  {t.area === 'office' ? ' · office' : ''}{t.private ? ' · private' : ''}
                </span>
                {t.note && <span className="note">{t.note}</span>}
              </div>
              <span className={`badge ${t.status}`}>{STATUS_LABEL[t.status]}</span>
              <div className="item-actions">
                <button type="button" className="ghost sm" onClick={() => edit(t)} aria-label={`${t.title} edit`}>Edit</button>
                <button type="button" className="ghost sm danger" onClick={() => remove(t)} aria-label={`${t.title} delete`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
