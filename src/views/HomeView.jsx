import { useEffect, useState } from 'react';
import { isoDate, fmtDuration } from '../lib/time.js';
import { tasksOn, summarize, insights } from '../lib/analyze.js';
import { streak, consistency, weekCompare, trend, topTaskToday, energyTrend, encouragement } from '../lib/dashboard.js';
import { loadPrioritiesPlan } from '../lib/storage.js';
import MorningBriefingCard from '../components/MorningBriefingCard.jsx';

const ARROW = { up: '↑', down: '↓', same: '→' };

function Compare({ label, now, prev, fmt, prevWord, higherIsGood = true }) {
  const tr = trend(now, prev);
  const good = tr === 'same' ? 'same' : (tr === 'up') === higherIsGood ? 'good' : 'bad';
  return (
    <div className="cmp">
      <span className="cmp-label">{label}</span>
      <span className="cmp-now">{now === null ? '–' : fmt(now)}</span>
      <span className={tr ? `cmp-arrow ${good}` : 'cmp-arrow'}>
        {tr ? (
          <>
            <span aria-hidden="true">{ARROW[tr]}</span>
            <span className="sr-only">{tr}</span>
          </>
        ) : ''}
      </span>
      <span className="cmp-prev muted">{prevWord}: {prev === null ? '–' : fmt(prev)}</span>
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

function greetKey() {
  const h = new Date().getHours();
  if (h < 12) return 'gm';
  if (h < 17) return 'ga';
  return 'ge';
}

function scoreKey(s) {
  if (s >= 80) return 'score_great';
  if (s >= 50) return 'score_good';
  if (s > 0) return 'score_start';
  return 'score_none';
}

export default function HomeView({ tasks, goTo, settings, t, layout, notify }) {
  const today = isoDate();
  const todays = tasksOn(tasks, today);
  const s = summarize(todays);
  const st = streak(tasks, today);
  const c = consistency(tasks, today);
  const w = weekCompare(tasks, today);
  const top = topTaskToday(tasks, today);
  const energy = energyTrend(tasks, today);
  const tips = layout.homeTips ? insights(tasks, today).filter((i) => i.kind !== 'balance').slice(0, 2) : [];
  const name = String(settings?.name || '').trim();
  const pct = (x) => `${Math.round(x * 100)}%`;
  const scoreShown = useCountUp(c.score);
  const streakShown = useCountUp(st.current, 600);
  const [todayPlan, setTodayPlan] = useState(() => loadPrioritiesPlan(today));

  return (
    <section aria-labelledby="home-h">
      <div className="hero">
        <h2 id="home-h">{t(greetKey())}{name ? ', ' : ''}<span className="grad-text">{name}</span> 👋</h2>
        <p className="muted home-msg">{encouragement(st, todays.length, settings.lang)}</p>
      </div>

      {/* Subah Ka Priority Briefing & Action Hub */}
      <MorningBriefingCard
        t={t}
        todayPlan={todayPlan}
        setTodayPlan={setTodayPlan}
        notify={notify}
        goToPlan={() => goTo('plan')}
        lang={settings.lang}
      />

      {/* 1. Aaj */}
      <div className="card home-today">
        {todays.length ? (
          <p><strong>{t('today_count', todays.length, s.done, fmtDuration(s.totalMin))}</strong></p>
        ) : (
          <p><strong>{t('today_none')}</strong></p>
        )}
        <button type="button" className="primary" onClick={() => goTo('log')}>
          {todays.length ? t('more_task') : t('first_task')}
        </button>
      </div>

      {/* 2 + 3. Streak + score */}
      <div className="home-grid">
        <div className="card stat-card fire">
          <span className="big"><span className="flame" aria-hidden="true">🔥</span> {streakShown}</span>
          <span>{t('streak_days')}</span>
          <span className="hint">
            {st.todayPending && st.current > 0 ? `${t('today_pending')} · ` : ''}{t('best')}: {st.best}
          </span>
        </div>
        <div className="card stat-card ocean">
          <span className="big" aria-label={`${c.score} / 100`}>{scoreShown}<small>/100</small></span>
          <span>{t('consistency')}</span>
          <span className="hint">{t(scoreKey(c.score))}</span>
        </div>
      </div>
      <details className="card why-card">
        <summary>{t('score_how')}</summary>
        <p className="why">{c.why}. {c.from} → {c.to}.</p>
      </details>

      {/* 5. Aaj ka sabse zaroori kaam */}
      {top && (
        <div className="card top-task">
          <span className="hint">{t('top_task')}</span>
          <p><strong>{top.title}</strong> · {top.start}–{top.end}</p>
          <p className="why">{top.reason}</p>
        </div>
      )}

      {/* "Zyada" active users: Persona ki 2 observations */}
      {tips.length > 0 && (
        <>
          <h3>💡 {t('tips_title')}</h3>
          <ul className="insights">
            {tips.map((i) => <li key={i.kind + i.text} className="card"><p>{i.text}</p></li>)}
          </ul>
        </>
      )}

      {layout.homeExtras && (
        <>
          {/* 4. Hafta vs hafta */}
          <h3>{t('week_title')}</h3>
          <div className="card">
            <Compare prevWord={t('prev')} label={t('total_time')} now={w.now.count ? w.now.totalMin : null} prev={w.prev.count ? w.prev.totalMin : null} fmt={fmtDuration} />
            <Compare prevWord={t('prev')} label={t('tasks_done')} now={w.now.doneRate} prev={w.prev.doneRate} fmt={pct} />
            <Compare prevWord={t('prev')} label={t('focus_time')} now={w.now.count ? w.now.focusMin : null} prev={w.prev.count ? w.prev.focusMin : null} fmt={fmtDuration} />
            <Compare prevWord={t('prev')} label={t('avg_energy')} now={w.now.avgEnergy} prev={w.prev.avgEnergy} fmt={(x) => `${x.toFixed(1)}/5`} />
            <p className="hint">{t('week_hint')}</p>
          </div>

          {/* 6. Energy trend */}
          <h3>{t('energy_title')}</h3>
          <div className="card">
            <div className="spark" role="img" aria-label={`${t('energy_title')}: ${energy.filter((e) => e.avg !== null).map((e) => e.avg.toFixed(1)).join(', ') || '-'}`}>
              {energy.map((e) => {
                const lv = e.avg === null ? 'none' : e.avg < 2.5 ? 'low' : e.avg < 3.5 ? 'mid' : 'high';
                const h = e.avg === null ? 6 : Math.max(10, (e.avg / 5) * 100);
                return (
                  <span key={e.date} className="spark-col" title={`${e.date}: ${e.avg === null ? '-' : e.avg.toFixed(1)}`}>
                    <span className={`spark-bar ${lv}`} style={{ height: `${h}%` }} />
                    <span className="spark-day">{Number(e.date.slice(8))}</span>
                  </span>
                );
              })}
            </div>
            <p className="hint">
              <span className="dot high" /> <span className="dot mid" /> <span className="dot low" /> {t('energy_legend')}
            </p>
          </div>
        </>
      )}

      <div className="row wrap home-links">
        {layout.tabs.includes('analyse') && (
          <button type="button" className="ghost" onClick={() => goTo('analyse')}>{t('full_analysis')}</button>
        )}
        <button type="button" className="ghost" onClick={() => goTo('plan')}>{t('tomorrow_plan')}</button>
      </div>
    </section>
  );
}
