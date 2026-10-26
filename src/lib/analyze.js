// Analysis: tumhare tasks se pattern nikalta hai.
// Sab simple statistics hai (count, average, median) - koi "black box" nahi.
// Har insight ke saath "why" (kaaran) hota hai, taaki tum khud verify kar sako.

import { durationMin, toMin, fromMin, median, fmtDuration, addDays } from './time.js';
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
  const dinText = nDays === 1 ? 'Is 1 din' : `Pichhle ${nDays} din`;
  const officeShare = office + personal ? Math.round((office / (office + personal)) * 100) : 0;
  out.push({
    kind: 'balance',
    text: `${dinText} mein office ${fmtDuration(office)}, personal ${fmtDuration(personal)} (logged time ka ${officeShare}% office).`,
    why: `Tumhare ${sum.count} logged tasks ke start-end time jod ke. Jo time log nahi hua wo isme nahi hai.`,
  });

  // Sirf sach mein high (avg >= 3.5) ghante - predict.js bhi yahi rule use karta hai
  const best = bestHours(tasks).filter((b) => b.avg >= 3.5);
  if (best.length) {
    const h = best.map((b) => `${String(b.hour).padStart(2, '0')}:00`).join(', ');
    out.push({
      kind: 'energy',
      data: { hours: best.map((b) => b.hour) },
      text: `Tumhari energy sabse zyada ${h} ke aas-paas hoti hai. Mushkil kaam yahan rakho.`,
      why: best
        .map((b) => `${String(b.hour).padStart(2, '0')}:00 baje shuru hue ${b.samples} kaam mein tumne energy average ${b.avg.toFixed(1)}/5 di`)
        .join('. ') + '.',
    });
  }

  const f = focusInLowEnergy(tasks);
  if (f.focus >= 3 && f.low / f.focus >= 0.3) {
    out.push({
      kind: 'focus',
      data: { focus: f.focus, low: f.low },
      text: `Focus wale ${f.focus} kaam mein se ${f.low} low energy (1-2) mein hue. Inko high-energy time pe shift karo.`,
      why: `Deep work, Study aur Side project wale ${f.focus} kaam dekhe. ${f.low} mein tumne energy 1 ya 2 likhi thi.`,
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
      why: `${bias.samples} kaam jinme "Socha tha" bhara tha: aam taur pe 30 min socha to asli mein ~${Math.round(30 * bias.ratio)} min laga.`,
    });
  }

  for (const s of mostSkipped(tasks).slice(0, 2)) {
    const name = s.private ? (s.area === 'office' ? 'Ek office kaam' : 'Ek private kaam') : `"${s.title}"`;
    out.push({
      kind: 'skip',
      data: { title: s.private ? null : s.title, area: s.area, count: s.skipped },
      text: `${name} ${s.skipped} baar skip hua. Isko chhota karo ya din mein pehle rakho.`,
      why: `Ye kaam ${s.total} baar plan/log hua, usme ${s.skipped} baar "Skip" mark hua.`,
    });
  }

  const health = sum.byCategory.Health || 0;
  if (nDays >= 3 && health === 0) {
    out.push({
      kind: 'health',
      data: { days: nDays },
      text: `${nDays} din mein Health (walk/gym) ka koi task nahi. 20 min walk se shuru karo.`,
      why: `In ${nDays} din ke tasks mein "Health" category ka ek bhi kaam nahi mila.`,
    });
  }

  return out;
}

/**
 * Din ke andar jo time log nahi hua (pehle task ke start se aakhri task ke end tak).
 * Raat ki neend / din shuru hone se pehle ka time gap nahi maana jaata.
 * Raat 12 ke paar jaane wale tasks yahan ignore (unka end agle din hai).
 * @returns {Array<{start:string,end:string,min:number}>}
 */
export function findGaps(dayTasks, minGap = 30) {
  const spans = dayTasks
    .map((t) => [toMin(t.start), toMin(t.end)])
    .filter(([s, e]) => s !== null && e !== null && e > s)
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let coveredUntil = null;
  for (const [s, e] of spans) {
    if (coveredUntil !== null && s - coveredUntil >= minGap) {
      gaps.push({ start: fromMin(coveredUntil), end: fromMin(s), min: s - coveredUntil });
    }
    coveredUntil = coveredUntil === null ? e : Math.max(coveredUntil, e);
  }
  return gaps;
}

/**
 * Haal ke alag-alag kaam (naya pehle) -> ek tap mein dobara log karne ke liye.
 * Har kaam ka sabse naya version (area, category, private, socha-tha) use hota hai.
 */
export function recentTemplates(tasks, n = 6) {
  const sorted = [...tasks].sort((a, b) =>
    a.date === b.date ? b.start.localeCompare(a.start) : b.date.localeCompare(a.date)
  );
  const seen = new Set();
  const out = [];
  for (const t of sorted) {
    const k = normTitle(t.title);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      title: t.title,
      area: t.area,
      category: t.category,
      private: t.private,
      estMin: t.estMin,
    });
    if (out.length >= n) break;
  }
  return out;
}

/**
 * Focus wala kaam (Deep work / Study / Side project) aise ghante mein jahan tumhari energy
 * aam taur pe kam rehti hai -> ek chhota hint (rokta nahi). Kam data ho to kuch nahi bolta.
 * @returns {string|null}
 */
export function lowEnergyHint(history, category, start, minSamples = 2) {
  if (!FOCUS_CATEGORIES.has(category)) return null;
  const s = toMin(start);
  if (s === null) return null;
  const hour = Math.floor(s / 60);
  const byHour = energyByHour(history);
  const here = byHour.find((h) => h.hour === hour);
  if (!here || here.samples < minSamples || here.avg > 2.5) return null;
  const best = bestHours(history, 1, minSamples).filter((b) => b.avg >= 3.5)[0];
  const hh = (h) => `${String(h).padStart(2, '0')}:00`;
  return best
    ? `${hh(hour)} ke aas-paas tumhari energy aam taur pe ${here.avg.toFixed(1)}/5 rehti hai. Aise kaam ${hh(best.hour)} ke aas-paas zyada aasaan hote hain (avg ${best.avg.toFixed(1)}/5).`
    : `${hh(hour)} ke aas-paas tumhari energy aam taur pe ${here.avg.toFixed(1)}/5 rehti hai. Shuru karne se pehle 10-15 min ka break try karo.`;
}
