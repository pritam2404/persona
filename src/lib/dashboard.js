// Home dashboard ke numbers. Sab pure functions -> Node mein test hote hain.
// Rule: koi guilt / darr wale messages nahi. Data dikhao, halka sa agla step suggest karo.

import { addDays, durationMin } from './time.js';
import { FOCUS_CATEGORIES } from './model.js';
import { tasksOn, lastNDays, summarize, normTitle } from './analyze.js';
import { planTomorrow } from './predict.js';
import { t } from './i18n.js';

function loggedDaySet(tasks) {
  return new Set(tasks.map((t) => t.date));
}

/**
 * Lagatar kitne din log kiya.
 * Aaj abhi log nahi hua to streak tootti NAHI - kal tak ki ginti, `todayPending: true`.
 */
export function streak(tasks, today) {
  const days = loggedDaySet(tasks);
  const todayDone = days.has(today);
  let cur = 0;
  let d = todayDone ? today : addDays(today, -1);
  while (days.has(d)) {
    cur += 1;
    d = addDays(d, -1);
  }
  // Ab tak ki sabse lambi streak
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // sirf run ki shuruaat se gino
    let n = 0;
    let x = day;
    while (days.has(x)) {
      n += 1;
      x = addDays(x, 1);
    }
    best = Math.max(best, n);
  }
  return { current: cur, best, todayPending: !todayDone };
}

/**
 * Consistency score 0-100 = 60% (kitne din log kiya / 7) + 40% (kitne kaam poore hue).
 * Aaj abhi log nahi hua to window kal pe khatam hoti hai (aaj ka adhoora din score na giraye).
 */
export function consistency(tasks, today) {
  const end = loggedDaySet(tasks).has(today) ? today : addDays(today, -1);
  const win = lastNDays(tasks, end, 7);
  const loggedDays = loggedDaySet(win).size;
  const s = summarize(win);
  const score = Math.round((loggedDays / 7) * 60 + s.doneRate * 40);
  return {
    score,
    loggedDays,
    doneRate: s.doneRate,
    from: addDays(end, -6),
    to: end,
    why: `7 mein se ${loggedDays} din log kiya (${Math.round((loggedDays / 7) * 60)}/60) + ${Math.round(s.doneRate * 100)}% kaam poore (${Math.round(s.doneRate * 40)}/40)`,
  };
}

function weekStats(tasks) {
  const s = summarize(tasks);
  const worked = tasks.filter((t) => t.status !== 'skipped');
  const focusMin = worked
    .filter((t) => FOCUS_CATEGORIES.has(t.category))
    .reduce((n, t) => n + durationMin(t.start, t.end), 0);
  const avgEnergy = tasks.length ? tasks.reduce((n, t) => n + t.energy, 0) / tasks.length : null;
  return { totalMin: s.totalMin, doneRate: tasks.length ? s.doneRate : null, focusMin, avgEnergy, count: tasks.length };
}

/** Pichhle 7 din vs usse pehle ke 7 din */
export function weekCompare(tasks, today) {
  const thisWeek = lastNDays(tasks, today, 7);
  const prevEnd = addDays(today, -7);
  const prevWeek = lastNDays(tasks, prevEnd, 7);
  return { now: weekStats(thisWeek), prev: weekStats(prevWeek) };
}

/** Badlav ki disha: 'up' | 'down' | 'same' | null (pichhla data nahi) */
export function trend(now, prev, tolerance = 0.05) {
  if (now === null || prev === null || prev === undefined) return null;
  if (prev === 0) return now > 0 ? 'up' : 'same';
  const ch = (now - prev) / Math.abs(prev);
  if (Math.abs(ch) <= tolerance) return 'same';
  return ch > 0 ? 'up' : 'down';
}

/**
 * Aaj ka sabse zaroori kaam: "kal ke plan" (kal ke data se aaj ke liye bana) mein se
 * pehla focus kaam jo aaj abhi tak poora nahi hua. Focus na ho to pehla bacha hua kaam.
 */
export function topTaskToday(tasks, today) {
  const plan = planTomorrow(tasks, addDays(today, -1));
  const doneToday = new Set(
    tasksOn(tasks, today).filter((t) => t.status === 'done').map((t) => normTitle(t.title))
  );
  const left = plan.items.filter((i) => !doneToday.has(normTitle(i.title)));
  const pick = left.find((i) => i.focus) || left[0] || null;
  if (!pick) return null;
  // Plan "kal" ke nazariye se likha tha ("Aaj skip hua") - Home pe aaj ke hisaab se padho
  const reason = pick.reason
    .replace(/^Aaj skip hua/, 'Kal skip hua')
    .replace(/^Aaj adhoora raha/, 'Kal adhoora raha')
    .replace(/Focus kaam -> tumhara high-energy time\./, 'Focus kaam, isliye tumhare high-energy time pe.');
  return { ...pick, reason };
}

/** Pichhle n din ki roz ki average energy (log nahi hua to null) - purana pehle */
export function energyTrend(tasks, today, n = 14) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const list = tasksOn(tasks, date);
    out.push({
      date,
      avg: list.length ? list.reduce((s, t) => s + t.energy, 0) / list.length : null,
      count: list.length,
    });
  }
  return out;
}

/** Ek chhota, bina guilt wala message */
export function encouragement(st, todayCount, lang = 'hi') {
  if (todayCount > 0 && st.current >= 7) return t(lang, 'enc_streak7', st.current);
  if (todayCount > 0) return t(lang, 'enc_done');
  if (st.current > 0) return t(lang, 'enc_keep', st.current);
  if (st.best > 0) return t(lang, 'enc_restart');
  return t(lang, 'enc_first');
}

/**
 * Activeness ke hisaab se kya dikhana hai.
 * less = simple app (4 tabs, chhota Home), medium = sab, more = sab + Home pe insights.
 */
export function layoutFor(activity) {
  const all = ['home', 'log', 'analyse', 'plan', 'video', 'videos'];
  if (activity === 'less') return { tabs: ['home', 'log', 'plan', 'video'], homeExtras: false, homeTips: false };
  if (activity === 'more') return { tabs: all, homeExtras: true, homeTips: true };
  return { tabs: all, homeExtras: true, homeTips: false };
}
