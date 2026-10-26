import { useEffect, useState } from 'react';
import { isoDate, fmtDuration } from '../lib/time.js';
import { tasksOn, summarize } from '../lib/analyze.js';
import { streak, consistency, weekCompare, trend, topTaskToday, energyTrend, encouragement } from '../lib/dashboard.js';

const ARROW = { up: '↑', down: '↓', same: '→' };
const ARROW_WORD = { up: 'badha', down: 'ghata', same: 'utna hi' };

function Compare({ label, now, prev, fmt, higherIsGood = true }) {
  const t = trend(now, prev);
  const good = t === 'same' ? 'same' : (t === 'up') === higherIsGood ? 'good' : 'bad';
  return (
    <div className="cmp">
      <span className="cmp-label">{label}</span>
      <span className="cmp-now">{now === null ? '–' : fmt(now)}</span>
      <span className={t ? `cmp-arrow ${good}` : 'cmp-arrow'}>
        {t ? (
          <>
            <span aria-hidden="true">{ARROW[t]}</span>
            <span className="sr-only">{ARROW_WORD[t]}</span>
          </>
        ) : ''}
      </span>
      <span className="cmp-prev muted">{prev === null ? 'pichhla: –' : `pichhla: ${fmt(prev)}`}</span>
    </div>
  );
}

/** Number 0 se target tak ginti karta hua (0.8 sec). "Kam animation" setting pe seedha number. */
function useCountUp(target, ms = 800) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { setV(target); return undefined; }
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return v;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function scoreWord(s) {
  if (s >= 80) return 'Bahut badhiya';
  if (s >= 50) return 'Achha chal raha hai';
  if (s > 0) return 'Shuruaat ho gayi';
  return 'Abhi shuru karo';
}

export default function HomeView({ tasks, goTo, settings }) {
  const today = isoDate();
  const todays = tasksOn(tasks, today);
  const s = summarize(todays);
  const st = streak(tasks, today);
  const c = consistency(tasks, today);
  const w = weekCompare(tasks, today);
  const top = topTaskToday(tasks, today);
  const energy = energyTrend(tasks, today);
  const name = String(settings?.name || '').trim();
  const pct = (x) => `${Math.round(x * 100)}%`;
  const scoreShown = useCountUp(c.score);
  const streakShown = useCountUp(st.current, 600);

  return (
    <section aria-labelledby="home-h">
      <div className="hero">
        <h2 id="home-h">{greeting()}{name ? ', ' : ''}<span className="grad-text">{name}</span> 👋</h2>
        <p className="muted home-msg">{encouragement(st, todays.length)}</p>
      </div>

      {/* 1. Aaj */}
      <div className="card home-today">
        {todays.length ? (
          <p><strong>Aaj {todays.length} kaam log hue</strong>, {s.done} poore · {fmtDuration(s.totalMin)}</p>
        ) : (
          <p><strong>Aaj abhi kuch log nahi hua.</strong></p>
        )}
        <button type="button" className="primary" onClick={() => goTo('log')}>
          {todays.length ? '+ Aur kaam likho' : 'Pehla kaam likho'}
        </button>
      </div>

      {/* 2 + 3. Streak + score */}
      <div className="home-grid">
        <div className="card stat-card fire">
          <span className="big"><span className="flame" aria-hidden="true">🔥</span> {streakShown}</span>
          <span>din ki streak</span>
          <span className="hint">
            {st.todayPending && st.current > 0 ? 'Aaj ka baaki hai · ' : ''}Best: {st.best}
          </span>
        </div>
        <div className="card stat-card ocean">
          <span className="big" aria-label={`${c.score} out of 100`}>{scoreShown}<small>/100</small></span>
          <span>Consistency</span>
          <span className="hint">{scoreWord(c.score)}</span>
        </div>
      </div>
      <details className="card why-card">
        <summary>Score kaise bana?</summary>
        <p className="why">{c.why}. Din: {c.from} se {c.to}.</p>
      </details>

      {/* 5. Aaj ka sabse zaroori kaam */}
      {top && (
        <div className="card top-task">
          <span className="hint">Aaj ka sabse zaroori kaam</span>
          <p><strong>{top.title}</strong> · {top.start}–{top.end}</p>
          <p className="why">{top.reason}</p>
        </div>
      )}

      {/* 4. Hafta vs hafta */}
      <h3>Is hafte vs pichhle hafte</h3>
      <div className="card">
        <Compare label="Kul time" now={w.now.count ? w.now.totalMin : null} prev={w.prev.count ? w.prev.totalMin : null} fmt={fmtDuration} />
        <Compare label="Kaam poore" now={w.now.doneRate} prev={w.prev.doneRate} fmt={pct} />
        <Compare label="Focus time" now={w.now.count ? w.now.focusMin : null} prev={w.prev.count ? w.prev.focusMin : null} fmt={fmtDuration} />
        <Compare label="Avg energy" now={w.now.avgEnergy} prev={w.prev.avgEnergy} fmt={(x) => `${x.toFixed(1)}/5`} />
        <p className="hint">Is hafta = pichhle 7 din (aaj samet). Hara teer = behtar, laal = kam.</p>
      </div>

      {/* 6. Energy trend */}
      <h3>Energy, pichhle 14 din</h3>
      <div className="card">
        <div className="spark" role="img" aria-label={`Pichhle 14 din ki energy: ${energy.filter((e) => e.avg !== null).map((e) => e.avg.toFixed(1)).join(', ') || 'koi data nahi'}`}>
          {energy.map((e) => {
            const lv = e.avg === null ? 'none' : e.avg < 2.5 ? 'low' : e.avg < 3.5 ? 'mid' : 'high';
            const h = e.avg === null ? 6 : Math.max(10, (e.avg / 5) * 100);
            return (
              <span key={e.date} className="spark-col" title={`${e.date}: ${e.avg === null ? 'log nahi' : e.avg.toFixed(1)}`}>
                <span className={`spark-bar ${lv}`} style={{ height: `${h}%` }} />
                <span className="spark-day">{Number(e.date.slice(8))}</span>
              </span>
            );
          })}
        </div>
        <p className="hint">
          <span className="dot high" /> high &nbsp; <span className="dot mid" /> theek &nbsp; <span className="dot low" /> kam &nbsp; Khaali = us din log nahi hua.
        </p>
      </div>

      <div className="row wrap home-links">
        <button type="button" className="ghost" onClick={() => goTo('analyse')}>Poora analysis →</button>
        <button type="button" className="ghost" onClick={() => goTo('plan')}>Kal ka plan →</button>
      </div>
    </section>
  );
}
