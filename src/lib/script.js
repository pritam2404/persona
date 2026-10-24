// Coach video ki script banata hai: "aaj kaisa gaya" + "kal kaise better".
//
// PRIVACY RULE: script ek AI video service ko ja sakti hai (photo + awaaz banane ke liye).
// Isliye office task / private task ka NAAM kabhi script mein nahi jaata - sirf
// "office kaam" aur total time. Ye rule yahan code mein hai, user ki yaad pe nahi.
//
// Output format = Shorts Studio wala: line 1 = title, har agli line = ek "beat".

import { summarize, tasksOn, insights } from './analyze.js';

const T = {
  hi: {
    title: (name) => (name ? `${name}, आपका कल का प्लान` : 'आपका कल का प्लान'),
    hello: (name) => (name ? `नमस्ते ${name}। आज का छोटा सा रिव्यू।` : 'नमस्ते। आज का छोटा सा रिव्यू।'),
    noData: 'आज कोई टास्क नोट नहीं हुआ। कल से हर काम लिखना शुरू करें।',
    today: (n, done, total) =>
      `आज आपने ${n} काम नोट ${n === 1 ? 'किया' : 'किए'}, ${done} ${done === 1 ? 'पूरा हुआ' : 'पूरे हुए'}, कुल ${total}।`,
    office: (d) => `ऑफिस के काम में ${d} लगे।`,
    officeLabel: 'एक ऑफिस का काम',
    privateLabel: 'एक निजी काम',
    planIntro: (n) => `कल के लिए ${n} काम प्लान किए हैं।`,
    planItem: (time, label) => `${time} बजे, ${label}।`,
    officeBlock: (from, to) => `${from} से ${to} तक ऑफिस का काम।`,
    focus: 'मुश्किल काम आपके सबसे ज़्यादा एनर्जी वाले समय में रखे हैं।',
    bye: 'बस इतना ही। कल थोड़ा बेहतर, बस यही लक्ष्य है।',
    ins: {
      energy: (d) => `आपकी एनर्जी ${d.hours.map((h) => `${h} बजे`).join(' और ')} के आसपास सबसे ज़्यादा रहती है।`,
      focus: (d) => `फोकस वाले ${d.focus} में से ${d.low} काम कम एनर्जी में हुए।`,
      estimate: (d) => (d.over
        ? `काम आमतौर पर अंदाज़े से ${d.pct} प्रतिशत ज़्यादा समय लेता है, इसलिए थोड़ा बफर रखें।`
        : `काम आमतौर पर अंदाज़े से ${d.pct} प्रतिशत जल्दी खत्म होता है।`),
      skip: (d, label) => `${label} ${d.count} बार छूटा। इसे छोटा करें या दिन में पहले रखें।`,
      health: (d) => `${d.days} दिन में कोई वॉक या एक्सरसाइज़ नहीं हुई। बीस मिनट की वॉक से शुरू करें।`,
    },
  },
  en: {
    title: (name) => (name ? `${name}, your plan for tomorrow` : 'Your plan for tomorrow'),
    hello: (name) => (name ? `Hi ${name}. Here is a quick review of today.` : 'Hi. Here is a quick review of today.'),
    noData: 'No tasks were logged today. Start noting each task from tomorrow.',
    today: (n, done, total) => `Today you logged ${n} task${n === 1 ? '' : 's'}, finished ${done}, ${total} in total.`,
    office: (d) => `Office work took ${d}.`,
    officeLabel: 'an office task',
    privateLabel: 'a private task',
    planIntro: (n) => `I have planned ${n} tasks for tomorrow.`,
    planItem: (time, label) => `At ${time}, ${label}.`,
    officeBlock: (from, to) => `From ${from} to ${to}, office work.`,
    focus: 'Hard tasks are placed in your highest-energy hours.',
    bye: 'That is it. Just aim to be a little better tomorrow.',
    ins: {
      energy: (d) => `Your energy peaks around ${d.hours.map((h) => `${h} o'clock`).join(' and ')}.`,
      focus: (d) => `${d.low} of your ${d.focus} focus tasks happened at low energy.`,
      estimate: (d) => (d.over
        ? `Tasks usually take ${d.pct} percent longer than you estimate, so keep a buffer.`
        : `Tasks usually finish ${d.pct} percent faster than you estimate.`),
      skip: (d, label) => `${label} was skipped ${d.count} times. Make it smaller or do it earlier.`,
      health: (d) => `No walk or exercise in ${d.days} days. Start with a twenty minute walk.`,
    },
  },
};

/** Awaaz ke liye duration: "6h 15m" TTS ajeeb padhta hai, isliye pura shabd */
export function spokenDuration(min, lang = 'hi') {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const parts = [];
  if (lang === 'en') {
    if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (m || !h) parts.push(`${m} minutes`);
    return parts.join(' ');
  }
  if (h) parts.push(`${h} घंटे`);
  if (m || !h) parts.push(`${m} मिनट`);
  return parts.join(' ');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Private / office task ka naam chhupata hai */
export function safeLabel(item, lang = 'hi') {
  const t = T[lang] || T.hi;
  if (item.area === 'office') return t.officeLabel;
  if (item.private) return t.privateLabel;
  return item.title;
}

/**
 * @param {Array} allTasks
 * @param {string} today  YYYY-MM-DD
 * @param {object} plan   planTomorrow() ka output
 * @param {{lang?:'hi'|'en', name?:string, maxPlanItems?:number}} opts
 * @returns {{title:string, beats:string[], lang:string}}
 */
export function buildCoachScript(allTasks, today, plan, opts = {}) {
  const lang = T[opts.lang] ? opts.lang : 'hi';
  const t = T[lang];
  const name = String(opts.name || '').trim().slice(0, 40);
  const maxItems = opts.maxPlanItems ?? 5;
  const beats = [t.hello(name)];

  const todays = tasksOn(allTasks, today);
  if (!todays.length) {
    beats.push(t.noData);
  } else {
    const s = summarize(todays);
    beats.push(t.today(s.count, s.done, spokenDuration(s.totalMin, lang)));
    if (s.byArea.office) beats.push(t.office(spokenDuration(s.byArea.office, lang)));
  }

  // 2 sabse kaam ke insights, video ki bhasha mein (private naam data.title = null hota hai)
  for (const ins of insights(allTasks, today).filter((i) => t.ins[i.kind]).slice(0, 2)) {
    if (ins.kind === 'skip') {
      const label = ins.data.title
        ? `"${ins.data.title}"`
        : ins.data.area === 'office' ? capitalize(t.officeLabel) : capitalize(t.privateLabel);
      beats.push(t.ins.skip(ins.data, label));
    } else {
      beats.push(t.ins[ins.kind](ins.data));
    }
  }

  if (plan?.items?.length) {
    beats.push(t.planIntro(plan.items.length));
    // Lagatar office items ko ek block bana do ("9 se 2 tak office ka kaam")
    const blocks = [];
    for (const it of plan.items) {
      const last = blocks[blocks.length - 1];
      if (it.area === 'office' && last?.office) last.end = it.end;
      else blocks.push({ office: it.area === 'office', start: it.start, end: it.end, item: it });
    }
    for (const b of blocks.slice(0, maxItems)) {
      beats.push(b.office ? t.officeBlock(b.start, b.end) : t.planItem(b.start, safeLabel(b.item, lang)));
    }
    if (plan.items.some((i) => i.focus)) beats.push(t.focus);
  }
  beats.push(t.bye);

  return { title: t.title(name), beats, lang };
}

/** Shorts Studio / make_coach_video.py ke liye .txt */
export function toScriptTxt(script) {
  return [`# Persona coach script (lang=${script.lang})`, script.title, ...script.beats].join('\n') + '\n';
}

/** Avatar website mein paste karne ke liye ek hi paragraph */
export function toNarration(script) {
  return script.beats.join(' ');
}
