// Task ka "shape" (data model) aur validation.
// Ek task = ek kaam jo tumne kiya (ya karna tha).

import { toMin } from './time.js';

export const AREAS = ['personal', 'office'];
export const STATUSES = ['done', 'partial', 'skipped'];

export const CATEGORIES = [
  'Deep work',   // focus wala kaam (coding, analysis, audit)
  'Study',
  'Meetings',
  'Admin',       // mail, chat, chhote kaam
  'Health',      // gym, walk, yoga
  'Family',
  'Side project',
  'Chores',
  'Break',
  'Other',
];

// Ye categories zyada dimaag maangti hain -> inhe best energy ghante mein rakhna chahiye
export const FOCUS_CATEGORIES = new Set(['Deep work', 'Study', 'Side project']);

let counter = 0;
export function newId() {
  counter += 1;
  return `t-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Task ko check karta hai. Galtiyon ki list deta hai (khali list = sab theek).
 */
export function validateTask(t) {
  const errors = [];
  if (!t || typeof t !== 'object') return ['Task object nahi hai'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) errors.push('Date galat hai');
  if (!t.title || !String(t.title).trim()) errors.push('Task ka naam likho');
  if (!AREAS.includes(t.area)) errors.push('Area personal ya office hona chahiye');
  if (!CATEGORIES.includes(t.category)) errors.push('Category chuno');
  if (toMin(t.start) === null) errors.push('Start time galat hai');
  if (toMin(t.end) === null) errors.push('End time galat hai');
  if (!STATUSES.includes(t.status)) errors.push('Status chuno');
  const e = Number(t.energy);
  if (!Number.isInteger(e) || e < 1 || e > 5) errors.push('Energy 1 se 5 ke beech');
  if (t.estMin !== null && t.estMin !== undefined && t.estMin !== '') {
    const est = Number(t.estMin);
    if (!Number.isFinite(est) || est <= 0 || est > 1440) errors.push('Estimate 1-1440 min');
  }
  return errors;
}

/** Form ke raw values ko saaf task object mein badalta hai. */
export function normalizeTask(raw) {
  const est = raw.estMin === '' || raw.estMin === undefined || raw.estMin === null
    ? null
    : Number(raw.estMin);
  return {
    id: raw.id || newId(),
    date: raw.date,
    title: String(raw.title || '').trim().slice(0, 120),
    area: raw.area,
    category: raw.category,
    start: raw.start,
    end: raw.end,
    estMin: est,
    energy: Number(raw.energy),
    status: raw.status,
    note: String(raw.note || '').trim().slice(0, 500),
    // private = video script mein naam kabhi nahi aayega. Office task hamesha private.
    private: raw.area === 'office' ? true : Boolean(raw.private),
  };
}

/** Import ki gayi JSON file check karta hai. Sirf valid tasks wapas deta hai. */
export function parseImport(json) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return { tasks: [], rejected: 0, error: 'File JSON nahi hai' };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.tasks) ? data.tasks : null;
  if (!list) return { tasks: [], rejected: 0, error: 'File mein tasks list nahi mili' };
  const tasks = [];
  let rejected = 0;
  for (const raw of list) {
    const t = normalizeTask(raw || {});
    if (validateTask(t).length) rejected += 1;
    else tasks.push(t);
  }
  return { tasks, rejected, error: null };
}

/** Do lists ko id ke hisaab se jodta hai (phone + laptop data milane ke liye). Naya wala jeet-ta hai. */
export function mergeTasks(existing, incoming) {
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const t of incoming) map.set(t.id, t);
  return [...map.values()].sort((a, b) =>
    a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)
  );
}
