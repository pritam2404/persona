// Kal ka plan "predict" karta hai.
//
// Ye ML nahi hai, jaan-boojh ke. Kam data (< 30 din) pe ML sirf noise seekhta hai.
// Rules:
//   1. Aaj jo skip/partial hua -> kal carry-over (pehle).
//   2. Jo kaam pichhle 14 din mein >= 3 alag din hua -> "recurring", kal bhi rakho.
//   3. Duration = us kaam ka median actual time (estimate nahi), taaki plan realistic ho.
//   4. Focus wale kaam -> tumhare best energy ghanton mein.
//   5. Baaki -> din ke shuru se khaali jagah mein, overlap nahi.
// Har item ke saath `reason` hota hai.

import { toMin, fromMin, durationMin, median, addDays } from './time.js';
import { FOCUS_CATEGORIES } from './model.js';
import { lastNDays, normTitle, bestHours, distinctDays, tasksOn, estimateBias } from './analyze.js';

const DAY_START_DEFAULT = 9 * 60;
const DAY_END = 23 * 60;
const MIN_SLOT = 15;

function displayTitle(t) {
  return t.title;
}

/** Recurring kaam dhoondta hai: title -> {count of days, median duration, median start, sample task} */
export function recurringTasks(history, minDays = 3) {
  const groups = new Map();
  for (const t of history) {
    const k = normTitle(t.title);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const out = [];
  for (const [key, list] of groups) {
    const days = new Set(list.map((t) => t.date)).size;
    if (days < minDays) continue;
    const worked = list.filter((t) => t.status !== 'skipped');
    const durs = worked.map((t) => durationMin(t.start, t.end)).filter((d) => d > 0);
    const starts = list.map((t) => toMin(t.start)).filter((s) => s !== null);
    const latest = list[list.length - 1];
    out.push({
      key,
      sample: latest,
      days,
      durMin: durs.length ? Math.round(median(durs)) : (latest.estMin || 30),
      typicalStart: starts.length ? Math.round(median(starts)) : null,
      skipped: list.filter((t) => t.status === 'skipped').length,
    });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** Simple timeline jo batata hai kaunsa minute bhara hai */
class Timeline {
  constructor() {
    this.busy = [];
  }
  fits(s, e) {
    if (s < 0 || e > DAY_END) return false;
    return this.busy.every(([bs, be]) => e <= bs || s >= be);
  }
  /** `want` ke paas sabse pehli khali jagah (aage dhoondta hai, phir peeche) */
  /** Sirf [from, to] ke beech start hone wala slot, warna null */
  placeWithin(from, to, dur) {
    for (let s = from; s <= to && s + dur <= DAY_END; s += MIN_SLOT) {
      if (this.fits(s, s + dur)) return this.take(s, dur);
    }
    return null;
  }
  place(want, dur, earliest) {
    const step = MIN_SLOT;
    const startFrom = Math.max(earliest, Math.round(want / step) * step);
    for (let s = startFrom; s + dur <= DAY_END; s += step) {
      if (this.fits(s, s + dur)) return this.take(s, dur);
    }
    for (let s = startFrom - step; s >= earliest; s -= step) {
      if (this.fits(s, s + dur)) return this.take(s, dur);
    }
    return null;
  }
  take(s, dur) {
    this.busy.push([s, s + dur]);
    return [s, s + dur];
  }
}

/**
 * @returns {{date, items:[{title, area, category, private, start, end, reason, focus}], notes:[string], confidence:'low'|'medium'|'high', dataDays}}
 */
export function planTomorrow(allTasks, today) {
  const tomorrow = addDays(today, 1);
  const history = lastNDays(allTasks, today, 14);
  const dataDays = distinctDays(history);
  const notes = [];

  const candidates = [];
  const seen = new Set();

  // 1. carry-over
  for (const t of tasksOn(allTasks, today)) {
    if (t.status === 'done') continue;
    const k = normTitle(t.title);
    if (seen.has(k)) continue;
    seen.add(k);
    const planned = t.estMin || durationMin(t.start, t.end) || 30;
    candidates.push({
      src: t,
      dur: Math.max(MIN_SLOT, planned),
      want: null,
      priority: 0,
      reason: t.status === 'skipped' ? 'Aaj skip hua - carry-over' : 'Aaj adhoora raha - carry-over',
    });
  }

  // 2. recurring
  for (const r of recurringTasks(history)) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    candidates.push({
      src: r.sample,
      dur: Math.max(MIN_SLOT, r.durMin),
      want: r.typicalStart,
      priority: 1,
      reason: `Pichhle 14 din mein ${r.days} din kiya, aam taur pe ${r.durMin} min`,
    });
  }

  // Estimate bias -> carry-over items ko buffer
  const bias = estimateBias(history);
  if (bias && bias.ratio > 1.2) {
    for (const c of candidates) {
      if (c.priority === 0 && c.src.estMin) c.dur = Math.round(c.dur * Math.min(bias.ratio, 2));
    }
    notes.push(`Carry-over kaam mein ${Math.round((bias.ratio - 1) * 100)}% buffer joda, kyunki kaam aam taur pe estimate se lamba chalta hai.`);
  }

  // Din kab shuru hota hai
  const firstStarts = [];
  for (const d of new Set(history.map((t) => t.date))) {
    const s = tasksOn(history, d).map((t) => toMin(t.start)).filter((x) => x !== null);
    if (s.length) firstStarts.push(Math.min(...s));
  }
  const dayStart = firstStarts.length ? Math.round(median(firstStarts) / 15) * 15 : DAY_START_DEFAULT;

  // "High energy" = avg >= 3.5. Aisa koi ghanta na mile to subah 10 baje maan lete hain.
  const best = bestHours(history, 3).filter((b) => b.avg >= 3.5);
  const focusHours = best.length ? best.map((b) => b.hour * 60) : [10 * 60];

  const tl = new Timeline();
  const items = [];

  // Focus wale pehle (best hours mein), phir baaki
  const focus = candidates.filter((c) => FOCUS_CATEGORIES.has(c.src.category));
  const rest = candidates.filter((c) => !FOCUS_CATEGORIES.has(c.src.category));
  focus.sort((a, b) => a.priority - b.priority);
  rest.sort((a, b) => a.priority - b.priority || (a.want ?? 1e9) - (b.want ?? 1e9));

  for (const c of focus) {
    // Har high-energy ghante ke 90 min window mein jagah dhoondo; na mile to normal jagah
    let slot = null;
    for (const h of focusHours) {
      slot = tl.placeWithin(Math.max(h, dayStart), h + 90, c.dur);
      if (slot) break;
    }
    if (slot) {
      items.push(makeItem(c, slot, `${c.reason}. Focus kaam -> tumhara high-energy time.`, true));
      continue;
    }
    slot = tl.place(c.want ?? dayStart, c.dur, dayStart);
    if (slot) items.push(makeItem(c, slot, `${c.reason}. High-energy time bhara tha, isliye yahan.`, true));
  }
  for (const c of rest) {
    const slot = tl.place(c.want ?? dayStart, c.dur, dayStart);
    if (!slot) continue;
    items.push(makeItem(c, slot, c.reason, false));
  }
  items.sort((a, b) => toMin(a.start) - toMin(b.start));

  const confidence = dataDays >= 14 ? 'high' : dataDays >= 7 ? 'medium' : 'low';
  if (confidence === 'low') {
    notes.push(`Abhi sirf ${dataDays} din ka data hai. 7+ din log karo, plan behtar hoga.`);
  }
  if (!items.length) {
    notes.push('Kal ke liye koi pattern nahi mila. Kuch din aur log karo.');
  }

  return { date: tomorrow, items, notes, confidence, dataDays };
}

function makeItem(c, [s, e], reason, focus) {
  return {
    title: displayTitle(c.src),
    area: c.src.area,
    category: c.src.category,
    private: c.src.private,
    start: fromMin(s),
    end: fromMin(e),
    reason,
    focus,
  };
}
