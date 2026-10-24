import { useState } from 'react';
import { CATEGORIES, normalizeTask, validateTask, mergeTasks } from '../lib/model.js';
import { tasksOn, summarize } from '../lib/analyze.js';
import { durationMin, fmtDuration, addDays } from '../lib/time.js';

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function emptyForm(day, lastEnd) {
  return {
    id: '', date: day, title: '', area: 'personal', category: 'Other',
    start: lastEnd || '09:00', end: nowHHMM(), estMin: '', energy: 3,
    status: 'done', note: '', private: false,
  };
}

const STATUS_LABEL = { done: 'Ho gaya', partial: 'Adhoora', skipped: 'Skip' };

export default function LogView({ tasks, setTasks, day, setDay, notify }) {
  const todays = tasksOn(tasks, day);
  const lastEnd = todays.length ? todays[todays.length - 1].end : '';
  const [form, setForm] = useState(() => emptyForm(day, lastEnd));
  const [errors, setErrors] = useState([]);

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

      <h2 id="log-h">{form.id ? 'Task edit karo' : 'Naya task'}</h2>
      <form className="card form" onSubmit={submit} noValidate>
        <label className="full">
          Kya kiya?
          <input value={form.title} onChange={set('title')} placeholder="jaise: Audit queue, Gym, Python practice" maxLength={120} required />
        </label>

        <fieldset className="seg">
          <legend>Area</legend>
          {['personal', 'office'].map((a) => (
            <label key={a} className={form.area === a ? 'chip on' : 'chip'}>
              <input type="radio" name="area" value={a} checked={form.area === a} onChange={set('area')} />
              {a === 'personal' ? 'Personal' : 'Office'}
            </label>
          ))}
        </fieldset>

        <label>
          Category
          <select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label>
          Start
          <input type="time" value={form.start} onChange={set('start')} required />
        </label>
        <label>
          End
          <input type="time" value={form.end} onChange={set('end')} required />
        </label>
        <label>
          Socha tha (min)
          <input type="number" min="1" max="1440" inputMode="numeric" value={form.estMin} onChange={set('estMin')} placeholder="optional" />
        </label>

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
