// AI chat (Google Gemini) - user ki APNI free API key se, seedha browser se.
//
// PRIVACY: AI ko sirf chhota summary jaata hai. Kabhi NAHI jaata:
//   - office / private task ke naam (safeLabel se "an office task")
//   - task ke notes (unme kuch bhi ho sakta hai)
// Jawaab chhote rakhne ke liye: system prompt + maxOutputTokens + shortAnswer().

import { isoDate, fmtDuration, addDays } from './time.js';
import { tasksOn, summarize, bestHours, insights, lastNDays } from './analyze.js';
import { planTomorrow } from './predict.js';
import { safeLabel } from './script.js';
import { streak, consistency, weekCompare } from './dashboard.js';
import { LANGS } from './i18n.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
export const KEY_STORE = 'persona.gemini.key';
const MODEL_STORE = 'persona.gemini.model';

/** Task ko AI ke liye safe naam do */
function safeTitle(t) {
  if (t.area === 'office') return 'an office task';
  if (t.private) return 'a private task';
  return t.title;
}

/**
 * User ka data -> chhota, safe text summary (English mein, AI ke liye).
 * @returns {string}
 */
export function buildContext(tasks, settings = {}, today = isoDate()) {
  const lines = [];
  const prof = [];
  if (settings.name) prof.push(`name ${settings.name}`);
  if (settings.age) prof.push(`age ${settings.age}`);
  if (settings.sex) prof.push(`gender ${settings.sex}`);
  if (settings.activity) prof.push(`app usage: ${settings.activity}`);
  if (prof.length) lines.push(`Profile: ${prof.join(', ')}.`);
  lines.push(`Today is ${today}.`);

  const st = streak(tasks, today);
  const c = consistency(tasks, today);
  lines.push(`Logging streak: ${st.current} days (best ${st.best})${st.todayPending ? ', nothing logged today yet' : ''}.`);
  lines.push(`Consistency score (last 7 days): ${c.score}/100; logged ${c.loggedDays}/7 days; ${Math.round(c.doneRate * 100)}% tasks done.`);

  const w = weekCompare(tasks, today);
  const wk = (s) => (s.count
    ? `${s.count} tasks, ${fmtDuration(s.totalMin)} total, focus ${fmtDuration(s.focusMin)}, ${Math.round((s.doneRate || 0) * 100)}% done, avg energy ${s.avgEnergy?.toFixed(1)}/5`
    : 'no data');
  lines.push(`This week: ${wk(w.now)}. Last week: ${wk(w.prev)}.`);

  const hist = lastNDays(tasks, today, 14);
  const best = bestHours(hist, 3);
  if (best.length) lines.push(`Energy by start hour (14 days): ${best.map((b) => `${b.hour}:00 avg ${b.avg.toFixed(1)}`).join('; ')}.`);

  const todays = tasksOn(tasks, today);
  if (todays.length) {
    const s = summarize(todays);
    lines.push(`Today's tasks (${s.count}, ${fmtDuration(s.totalMin)}): ${todays
      .map((x) => `${x.start}-${x.end} ${safeTitle(x)} [${x.category}, energy ${x.energy}, ${x.status}]`)
      .join('; ')}.`);
  }
  const yday = tasksOn(tasks, addDays(today, -1));
  if (yday.length) lines.push(`Yesterday: ${yday.length} tasks, ${yday.filter((x) => x.status === 'done').length} done.`);

  const ins = insights(tasks, today).filter((i) => i.kind !== 'balance');
  if (ins.length) {
    lines.push(`Patterns: ${ins.map((i) => {
      if (i.kind === 'energy') return `energy peaks at ${i.data.hours.map((h) => `${h}:00`).join(', ')}`;
      if (i.kind === 'focus') return `${i.data.low} of ${i.data.focus} focus tasks done at low energy`;
      if (i.kind === 'estimate') return `tasks take ${i.data.pct}% ${i.data.over ? 'longer' : 'less time'} than estimated`;
      if (i.kind === 'skip') return `${i.data.title ? `"${i.data.title}"` : i.data.area === 'office' ? 'an office task' : 'a private task'} skipped ${i.data.count} times`;
      if (i.kind === 'health') return `no exercise in ${i.data.days} days`;
      return '';
    }).filter(Boolean).join('; ')}.`);
  }

  const plan = planTomorrow(tasks, today);
  if (plan.items.length) {
    lines.push(`Suggested plan for tomorrow: ${plan.items.map((i) => `${i.start}-${i.end} ${safeLabel(i, 'en')}${i.focus ? ' (focus)' : ''}`).join('; ')}.`);
  }
  return lines.join('\n');
}

export function systemPrompt(lang = 'en') {
  const L = LANGS.find((l) => l.code === lang);
  const langName = lang === 'hi' ? 'Hinglish (Hindi in Latin script, casual)' : (L?.en || 'English');
  return [
    'You are Persona, a friendly personal productivity coach inside a daily task-tracking app.',
    `Always reply in ${langName}.`,
    'Rules: answer in at most 3 short sentences (under 60 words). Be specific and practical, use the user data below.',
    'No long explanations, no history lessons, no lists longer than 3 items, no markdown headings.',
    'If the answer is not in the data, say so in one line and suggest what to log.',
    'Never guilt-trip. Do not give medical, legal or financial advice; suggest a professional instead.',
  ].join(' ');
}

/** Models ki list se sabse naya "flash" model chuno (naam future mein badal sakte hain) */
export function pickModel(models) {
  const ok = (models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'));
  const ver = (n) => {
    const x = /gemini-(\d+(?:\.\d+)?)-flash/.exec(n);
    return x ? Number(x[1]) : -1;
  };
  const flash = ok
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-\d+(\.\d+)?-flash(-latest)?$/.test(n))
    .sort((a, b) => ver(b) - ver(a) || a.length - b.length);
  if (flash.length) return flash[0];
  const any = ok.map((m) => m.name.replace(/^models\//, '')).find((n) => n.includes('flash') && !n.includes('image'));
  return any || 'gemini-3.8-flash';
}

/** Gemini response -> text (parts jod ke) */
export function parseAnswer(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
  if (!text) {
    const why = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason || 'empty';
    throw new Error(`No answer (${why})`);
  }
  return text;
}

/** Model kabhi lamba likh de to bhi max 4 sentences / 600 chars */
export function shortAnswer(text, maxSentences = 4, maxChars = 600) {
  const clean = String(text).replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim();
  const sentences = clean.match(/[^.!?।]+[.!?।]+|\S[^.!?।]*$/g) || [clean];
  let out = sentences.slice(0, maxSentences).join(' ').replace(/\s+/g, ' ').trim();
  if (out.length > maxChars) out = `${out.slice(0, maxChars - 1).trim()}…`;
  return out;
}

function friendlyError(status, body) {
  const msg = body?.error?.message || '';
  if (status === 400 && /api key/i.test(msg)) return 'API key galat hai. Settings mein dobara daalo.';
  if (status === 403) return 'Is key ko Gemini API ki permission nahi hai.';
  if (status === 429) return 'Aaj ki free limit khatam ho gayi. Thodi der baad try karo.';
  if (status >= 500) return 'Google ka server abhi busy hai. Thodi der baad try karo.';
  return msg || `Error ${status}`;
}

async function getJSON(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Internet ya Google tak connection nahi hua.');
  }
  let body = null;
  try { body = await res.json(); } catch { /* khaali body */ }
  if (!res.ok) {
    const e = new Error(friendlyError(res.status, body));
    e.status = res.status;
    throw e;
  }
  return body;
}

export async function resolveModel(apiKey) {
  const cached = localStorage.getItem(MODEL_STORE);
  if (cached) return cached;
  const list = await getJSON(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  const m = pickModel(list.models);
  localStorage.setItem(MODEL_STORE, m);
  return m;
}

/**
 * @param {{apiKey:string, history:{role:'user'|'model', text:string}[], question:string, context:string, lang:string}} o
 */
export async function askGemini(o) {
  const model = await resolveModel(o.apiKey);
  const contents = [...o.history.slice(-6), { role: 'user', text: o.question }]
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  // NOTE: Gemini 3.6+ ne temperature jaise sampling settings hata diye - bhejo to 400 error.
  // Isliye pehle chhota config, 400 aaye to bina kisi config ke dobara.
  const base = {
    systemInstruction: { parts: [{ text: `${systemPrompt(o.lang)}\n\nUSER DATA:\n${o.context}` }] },
    contents,
  };
  const attempts = [{ ...base, generationConfig: { maxOutputTokens: 1024 } }, base];
  let lastErr;
  for (const body of attempts) {
    try {
      const json = await getJSON(`${API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey },
        body: JSON.stringify(body),
        signal: o.signal,
      });
      return shortAnswer(parseAnswer(json));
    } catch (err) {
      lastErr = err;
      // Model hata diya gaya ho to cache saaf karke agli baar naya chuno
      if (/not found|not supported for generateContent/i.test(err.message)) {
        localStorage.removeItem(MODEL_STORE);
        break;
      }
      if (!err.status || err.status !== 400 || /api key/i.test(err.message)) break;
    }
  }
  throw lastErr;
}

// ---------------- One-click (bina API key) ----------------

/**
 * Ek chhota prompt: rules + safe data + sawaal. Google/Gemini mein paste/URL ke liye.
 * URL lambi na ho isliye data ~1200 characters tak.
 */
export function oneClickPrompt(question, context, lang = 'hi', maxData = 1200) {
  const L = LANGS.find((l) => l.code === lang);
  const langName = lang === 'hi' ? 'Hinglish' : (L?.en || 'English');
  const data = context.length > maxData ? `${context.slice(0, maxData).trim()}…` : context;
  return [
    `You are my productivity coach. Reply in ${langName}, max 3 short sentences, practical, based on my data.`,
    `My data:\n${data}`,
    `My question: ${String(question).trim()}`,
  ].join('\n\n');
}

/** Google AI Mode (Gemini se chalta hai): sawaal URL mein -> ek tap mein jawaab */
export function googleAiUrl(prompt) {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(prompt)}`;
}

export const GEMINI_APP_URL = 'https://gemini.google.com/app';

export function looksLikeKey(k) {
  return /^[A-Za-z0-9_-]{30,60}$/.test(String(k || '').trim());
}
