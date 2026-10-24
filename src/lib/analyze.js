// Analysis: tumhare tasks se pattern nikalta hai.
// Sab simple statistics hai (count, average, median) - koi "black box" nahi.
// Har insight ke saath "why" (kaaran) hota hai, taaki tum khud verify kar sako.

import { durationMin, toMin, median, fmtDuration, addDays } from './time.js';
import { FOCUS_CATEGORIES } from './model.js';

export function tasksOn(tasks, date) {
  return tasks.filter((t) => t.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

/** Pichhle n din (aaj samet) ke tasks */
export function lastNDays(tasks, today, n) {
  const from = addDays(today, -(n - 1));
  return tasks.filter((t) => t.date >= from && t.date <= today);
}

export function distinctDays(tasks) {
  return new Set(tasks.map((t) => t.date)).size;
}

/** Ek din / range ka summary */
export function summarize(tasks) {
  const byArea = {};
  const byCategory = {};
  let total = 0;
  let done = 0;
  let skipped = 0;
  let partial = 0;
  for (const t of tasks) {
    const d = t.status === 'skipped' ? 0 : durationMin(t.start, t.end);
    total += d;
    byArea[t.area] = (byArea[t.area] || 0) + d;
    byCategory[t.category] = (byCategory[t.category] || 0) + d;
    if (t.status === 'done') done += 1;
    else if (t.status === 'skipped') skipped += 1;
    else partial += 1;
  }
  const n = tasks.length;
  return {
    count: n,
    totalMin: total,
    byArea,
    byCategory,
    doneRate: n ? done / n : 0,
    skipRate: n ? skipped / n : 0,
    done,
    skipped,
    partial,
  };
}

/** Har ghante ki average energy (0-23). Sirf jahan data hai. */
export function energyByHour(tasks) {
  const buckets = new Map();
  for (const t of tasks) {
    const s = toMin(t.start);
    if (s === null) continue;
    const h = Math.floor(s / 60);
    if (!buckets.has(h)) buckets.set(h, []);
    buckets.get(h).push(t.energy);
  }
  return [...buckets.entries()]
    .map(([hour, arr]) => ({
      hour,
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
      samples: arr.length,
    }))
    .sort((a, b) => a.hour - b.hour);
}

/** Sabse achhe ghante (energy ke hisaab se). minSamples se kam data wale ghante ignore. */
export function bestHours(tasks, k = 2, minSamples = 2) {
  return energyByHour(tasks)
    .filter((h) => h.samples >= minSamples)
    .sort((a, b) => b.avg - a.avg || a.hour - b.hour)
    .slice(0, k);
}

/**
 * Estimate kitna sahi hota hai.
 * ratio > 1 = tum kaam ko kam aankte ho (zyada time lagta hai).
 */
export function estimateBias(tasks) {
  const ratios = tasks
    .filter((t) => t.status !== 'skipped' && t.estMin > 0)
    .map((t) => durationMin(t.start, t.end) / t.estMin)
    .filter((r) => r > 0);
  if (ratios.length < 3) return null;
  return { ratio: median(ratios), samples: ratios.length };
}

/** Naam ko compare karne layak banata hai ("Gym " == "gym") */
export function normTitle(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Kaunse kaam baar-baar skip hote hain */
export function mostSkipped(tasks, minCount = 2) {
  const stats = new Map();
  for (const t of tasks) {
    const k = normTitle(t.title);
    const s = stats.get(k) || { title: t.title, total: 0, skipped: 0, private: t.private, area: t.area };
    s.total += 1;
    if (t.status === 'skipped') s.skipped += 1;
    stats.set(k, s);
  }
  return [...stats.values()]
    .filter((s) => s.skipped >= minCount)
    .map((s) => ({ ...s, rate: s.skipped / s.total }))
    .sort((a, b) => b.skipped - a.skipped || b.rate - a.rate);
}

/** Focus wala kaam low-energy ghante mein kitni baar hua */
export function focusInLowEnergy(tasks) {
  const focus = tasks.filter((t) => FOCUS_CATEGORIES.has(t.category) && t.status !== 'skipped');
  const low = focus.filter((t) => t.energy <= 2);
  return { focus: focus.length, low: low.length };
}

/**
 * Insights: plain-language observations. Har ek mein `why` = data jo isko support karta hai.
 * `label(task)` se naam dikhaate hain - private task ka naam nahi.
 */
export function insights(allTasks, today, days = 14) {
  const tasks = lastNDays(allTasks, today, days);
  const out = [];
  const nDays = distinctDays(tasks);
  if (!tasks.length) return out;

  const sum = summarize(tasks);
  const office = sum.byArea.office || 0;
  const personal = sum.byArea.personal || 0;
  out.push({
    kind: 'balance',
    text: `Pichhle ${nDays} din mein office ${fmtDuration(office)}, personal ${fmtDuration(personal)}.`,
    why: `${sum.count} tasks log hue`,
  });

  // Sirf sach mein high (avg >= 3.5) ghante - predict.js bhi yahi rule use karta hai
  const best = bestHours(tasks).filter((b) => b.avg >= 3.5);
  if (best.length) {
    const h = best.map((b) => `${String(b.hour).padStart(2, '0')}:00`).join(', ');
    out.push({
      kind: 'energy',
      data: { hours: best.map((b) => b.hour) },
      text: `Tumhari energy sabse zyada ${h} ke aas-paas hoti hai. Mushkil kaam yahan rakho.`,
      why: best.map((b) => `${b.hour}:00 avg ${b.avg.toFixed(1)}/5 (${b.samples} tasks)`).join('; '),
    });
  }

  const f = focusInLowEnergy(tasks);
  if (f.focus >= 3 && f.low / f.focus >= 0.3) {
    out.push({
      kind: 'focus',
      data: { focus: f.focus, low: f.low },
      text: `Focus wale ${f.focus} kaam mein se ${f.low} low energy (1-2) mein hue. Inko high-energy time pe shift karo.`,
      why: 'Category: Deep work / Study / Side project, energy <= 2',
    });
  }

  const bias = estimateBias(tasks);
  if (bias && Math.abs(bias.ratio - 1) >= 0.2) {
    const pct = Math.round(Math.abs(bias.ratio - 1) * 100);
    out.push({
      kind: 'estimate',
      data: { over: bias.ratio > 1, pct },
      text: bias.ratio > 1
        ? `Kaam aam taur pe estimate se ${pct}% zyada time leta hai. Plan banate waqt buffer rakho.`
        : `Kaam aam taur pe estimate se ${pct}% jaldi khatam hota hai. Tum zyada plan kar sakte ho.`,
      why: `${bias.samples} tasks ka median (actual / estimate) = ${bias.ratio.toFixed(2)}`,
    });
  }

  for (const s of mostSkipped(tasks).slice(0, 2)) {
    const name = s.private ? (s.area === 'office' ? 'Ek office kaam' : 'Ek private kaam') : `"${s.title}"`;
    out.push({
      kind: 'skip',
      data: { title: s.private ? null : s.title, area: s.area, count: s.skipped },
      text: `${name} ${s.skipped} baar skip hua. Isko chhota karo ya din mein pehle rakho.`,
      why: `${s.skipped}/${s.total} baar skipped`,
    });
  }

  const health = sum.byCategory.Health || 0;
  if (nDays >= 3 && health === 0) {
    out.push({
      kind: 'health',
      data: { days: nDays },
      text: `${nDays} din mein Health (walk/gym) ka koi task nahi. 20 min walk se shuru karo.`,
      why: 'Health category = 0 min',
    });
  }

  return out;
}
