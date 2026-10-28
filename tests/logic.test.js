// Chalao: npm test   (Node ka built-in test runner, koi extra library nahi)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toMin, fromMin, durationMin, addDays } from '../src/lib/time.js';
import { validateTask, normalizeTask, parseImport, mergeTasks } from '../src/lib/model.js';
import { summarize, bestHours, estimateBias, insights } from '../src/lib/analyze.js';
import { planTomorrow, recurringTasks } from '../src/lib/predict.js';
import { buildCoachScript, toScriptTxt } from '../src/lib/script.js';
import { makeDemoTasks } from '../src/lib/demo.js';

const TODAY = '2026-10-23';

test('time helpers', () => {
  assert.equal(toMin('09:30'), 570);
  assert.equal(toMin('24:00'), null);
  assert.equal(fromMin(570), '09:30');
  assert.equal(durationMin('23:00', '01:00'), 120); // raat 12 ke paar
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('validation catches bad tasks, normalize forces office private', () => {
  const t = normalizeTask({
    date: TODAY, title: 'Audit', area: 'office', category: 'Deep work',
    start: '09:00', end: '10:00', estMin: '', energy: '4', status: 'done',
  });
  assert.deepEqual(validateTask(t), []);
  assert.equal(t.private, true);
  assert.equal(t.estMin, null);
  assert.ok(validateTask({ ...t, energy: 9 }).length > 0);
  assert.ok(validateTask({ ...t, start: 'abc' }).length > 0);
});

test('import rejects junk, merge dedupes by id', () => {
  const demo = makeDemoTasks(TODAY, 2);
  const r = parseImport(JSON.stringify({ tasks: [...demo, { title: 'bad' }] }));
  assert.equal(r.tasks.length, demo.length);
  assert.equal(r.rejected, 1);
  assert.equal(parseImport('not json').error, 'File JSON nahi hai');
  assert.equal(mergeTasks(demo, demo).length, demo.length);
});

test('analysis on demo data', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  const s = summarize(tasks.filter((t) => t.date === TODAY));
  assert.equal(s.count, 7);
  assert.ok(s.totalMin > 0);
  const best = bestHours(tasks);
  assert.equal(best[0].hour, 9); // Audit queue 09:30 has highest energy
  const bias = estimateBias(tasks);
  assert.ok(bias.ratio > 1); // demo kaam estimate se lamba chalta hai
  const kinds = insights(tasks, TODAY).map((i) => i.kind);
  assert.ok(kinds.includes('energy'));
  assert.ok(kinds.includes('estimate'));
  assert.ok(kinds.includes('skip'));
});

test('plan: recurring + carry-over, no overlaps, focus in best hour', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  assert.ok(recurringTasks(tasks).length >= 5);
  const plan = planTomorrow(tasks, TODAY);
  assert.equal(plan.date, '2026-10-24');
  assert.equal(plan.confidence, 'medium');
  assert.ok(plan.items.length >= 5);
  const spans = plan.items.map((i) => [toMin(i.start), toMin(i.end)]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i += 1) assert.ok(spans[i][0] >= spans[i - 1][1], 'overlap');
  // Aaj adhoora "SOP doubt review" (focus, carry-over) -> 09:00 best-energy slot pe pehle
  const sop = plan.items.find((i) => i.title === 'SOP doubt review');
  assert.equal(sop.start, '09:00');
  // Recurring "Audit queue" bhi focus hai -> usi high-energy window mein, SOP ke baad
  const audit = plan.items.find((i) => i.title === 'Audit queue');
  assert.ok(audit.focus && audit.start >= sop.end && audit.start <= '10:30', audit.start);
  assert.ok(plan.items.every((i) => i.reason));
});

test('plan with no data is empty + low confidence', () => {
  const plan = planTomorrow([], TODAY);
  assert.equal(plan.items.length, 0);
  assert.equal(plan.confidence, 'low');
});

test('coach script never leaks office/private titles (all 8 languages)', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  tasks.push({ ...tasks[0], id: 'p1', title: 'Doctor visit SECRET', private: true, date: TODAY, status: 'skipped' });
  const plan = planTomorrow(tasks, TODAY);
  for (const lang of ['hi', 'en', 'bn', 'pa', 'kn', 'ta', 'te', 'ml']) {
    const txt = toScriptTxt(buildCoachScript(tasks, TODAY, plan, { lang, name: 'Pritam' }));
    for (const secret of ['Audit queue', 'SOP doubt', 'Team standup', 'Email + Slack', 'SECRET']) {
      assert.ok(!txt.includes(secret), `${lang} script leaked "${secret}"`);
    }
    assert.ok(txt.includes('Pritam'));
  }
});

import { findGaps, recentTemplates } from '../src/lib/analyze.js';

const mk = (title, start, end, extra = {}) => ({
  id: `${title}-${start}`, date: TODAY, title, area: 'personal', category: 'Other',
  start, end, estMin: null, energy: 3, status: 'done', note: '', private: false, ...extra,
});

test('findGaps: only gaps between tasks, overlaps handled, small gaps ignored', () => {
  const day = [
    mk('A', '09:00', '10:00'),
    mk('B', '09:30', '11:00'), // overlap -> covered till 11:00
    mk('C', '11:20', '12:00'), // 20 min gap < 30 -> ignore
    mk('D', '14:00', '15:00'), // 12:00-14:00 gap
    mk('Night', '23:00', '01:00'), // crosses midnight -> ignored
  ];
  assert.deepEqual(findGaps(day), [{ start: '12:00', end: '14:00', min: 120 }]);
  assert.deepEqual(findGaps([]), []);
  assert.deepEqual(findGaps([mk('X', '09:00', '10:00')]), []); // ek task = koi gap nahi
});

test('recentTemplates: newest first, unique by title, keeps area/category/private', () => {
  const list = [
    mk('Gym', '07:00', '08:00', { date: '2026-10-21', category: 'Health' }),
    mk('Audit queue', '09:00', '11:00', { date: '2026-10-22', area: 'office', private: true, estMin: 90 }),
    mk('gym ', '07:00', '07:45', { date: '2026-10-23', category: 'Health' }),
  ];
  const r = recentTemplates(list);
  assert.deepEqual(r.map((x) => x.title), ['gym ', 'Audit queue']);
  assert.equal(r[1].area, 'office');
  assert.equal(r[1].private, true);
  assert.equal(r[1].estMin, 90);
  assert.equal(recentTemplates(list, 1).length, 1);
});

import { forSpeech } from '../src/lib/speech.js';

test('forSpeech: times become speakable, captions untouched elsewhere', () => {
  assert.equal(forSpeech('07:00 बजे, Morning walk।', 'hi'), 'सुबह 7 बजे, Morning walk।');
  assert.equal(forSpeech('21:30 बजे, Python practice।', 'hi'), 'रात साढ़े 9 बजे, Python practice।');
  assert.equal(forSpeech('09:00 से 14:00 तक ऑफिस का काम।', 'hi'), 'सुबह 9 बजे से दोपहर 2 बजे तक ऑफिस का काम।');
  assert.equal(forSpeech('13:15 बजे', 'hi'), 'दोपहर 1 बजकर 15 मिनट');
  assert.equal(forSpeech('काम 50% ज़्यादा', 'hi'), 'काम 50 प्रतिशत ज़्यादा');
  assert.equal(forSpeech('At 21:00, "Gym".', 'en'), 'At 9 PM, Gym.');
  assert.equal(forSpeech('From 09:30 to 12:00', 'en'), 'From 9:30 AM to 12 PM');
});

import { lowEnergyHint } from '../src/lib/analyze.js';

test('lowEnergyHint: only for focus work in a known low-energy hour', () => {
  const tasks = makeDemoTasks(TODAY, 10); // 21:00 Python practice energy 2, 09:30 Audit queue high
  const hint = lowEnergyHint(tasks, 'Study', '21:10');
  assert.ok(hint && hint.includes('21:00') && hint.includes('09:00'), hint);
  assert.equal(lowEnergyHint(tasks, 'Health', '21:10'), null); // focus category nahi
  assert.equal(lowEnergyHint(tasks, 'Study', '09:15'), null); // high energy ghanta
  assert.equal(lowEnergyHint(tasks, 'Study', '03:00'), null); // us ghante ka data hi nahi
  assert.equal(lowEnergyHint([], 'Study', '21:10'), null);
});

import { streak, consistency, weekCompare, trend, topTaskToday, energyTrend, encouragement } from '../src/lib/dashboard.js';

const onDays = (dates, extra = {}) => dates.map((date, i) => mk(`T${i}`, '09:00', '10:00', { id: `d${i}`, date, ...extra }));

test('streak: today pending does not break it; best streak found', () => {
  const t = onDays(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-21', '2026-10-22']);
  assert.deepEqual(streak(t, '2026-10-23'), { current: 2, best: 3, todayPending: true });
  assert.deepEqual(streak([...t, ...onDays(['2026-10-23'])], '2026-10-23'), { current: 3, best: 3, todayPending: false });
  assert.deepEqual(streak(t, '2026-10-25'), { current: 0, best: 3, todayPending: true }); // 2 din gap = toota
  assert.deepEqual(streak([], '2026-10-23'), { current: 0, best: 0, todayPending: true });
});

test('consistency: 60% days + 40% done, window ends yesterday if today empty', () => {
  const t = onDays(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-16']);
  const c = consistency(t, '2026-10-23'); // window 16..22, sab 7 din, sab done
  assert.equal(c.score, 100);
  assert.equal(c.to, '2026-10-22');
  const half = onDays(['2026-10-22'], { status: 'skipped' });
  assert.equal(consistency(half, '2026-10-23').score, Math.round((1 / 7) * 60)); // 9
  assert.equal(consistency([], '2026-10-23').score, 0);
});

test('weekCompare + trend', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  const w = weekCompare(tasks, TODAY);
  assert.ok(w.now.count > w.prev.count); // demo = 10 din -> pichhla hafta sirf 3 din
  assert.equal(trend(10, 5), 'up');
  assert.equal(trend(5, 10), 'down');
  assert.equal(trend(10, 10.2), 'same');
  assert.equal(trend(5, null), null);
  assert.equal(trend(3, 0), 'up');
});

test('topTaskToday: first focus item from yesterday\'s plan not yet done today', () => {
  const tasks = makeDemoTasks(TODAY, 10).filter((t) => t.date !== TODAY); // aaj kuch log nahi
  const top = topTaskToday(tasks, TODAY);
  assert.ok(top && top.focus, JSON.stringify(top));
  assert.ok(!/^Aaj /.test(top.reason), top.reason); // Home pe "Kal adhoora raha", "Aaj" nahi
  const doneIt = [...tasks, mk(top.title, '09:00', '10:00', { id: 'x', status: 'done' })];
  const next = topTaskToday(doneIt, TODAY);
  assert.notEqual(next?.title, top.title);
  assert.equal(topTaskToday([], TODAY), null);
});

test('energyTrend: 14 days, null where nothing logged', () => {
  const e = energyTrend(onDays(['2026-10-23'], { energy: 4 }), TODAY);
  assert.equal(e.length, 14);
  assert.equal(e[13].date, TODAY);
  assert.equal(e[13].avg, 4);
  assert.equal(e[0].avg, null);
});

test('encouragement never guilt-trips', () => {
  const msgs = [
    encouragement({ current: 0, best: 0 }, 0),
    encouragement({ current: 0, best: 5 }, 0),
    encouragement({ current: 3, best: 5 }, 0),
    encouragement({ current: 9, best: 9 }, 2),
  ];
  for (const m of msgs) assert.ok(!/fail|ready nahi|risk|kharab|nahi hoge/i.test(m), m);
});

import { LANGS, STRINGS, t as tr } from '../src/lib/i18n.js';
import { SCRIPT_LANGS, buildCoachScript as bcs } from '../src/lib/script.js';
import { layoutFor } from '../src/lib/dashboard.js';
import { voiceLangFor, defaultVoice } from '../src/lib/voices.js';

test('i18n: every language has the core screens; missing keys fall back to English', () => {
  const core = ['tab_home', 'tab_log', 'tab_plan', 'tab_story', 'ob_lang', 'ob_name', 'ob_activity', 'ob_done', 'next', 'today_none', 'first_task'];
  for (const l of LANGS) {
    assert.ok(STRINGS[l.code], l.code);
    for (const k of core) assert.ok(STRINGS[l.code][k], `${l.code} missing ${k}`);
    assert.equal(typeof tr(l.code, 'enc_keep', 3), 'string');
  }
  for (const k of Object.keys(STRINGS.en)) assert.ok(k in STRINGS.hi, `hi missing ${k}`);
  assert.equal(tr('ta', 'lock_hint'), STRINGS.en.lock_hint); // fallback
  assert.deepEqual(SCRIPT_LANGS.sort(), LANGS.map((l) => l.code).sort());
});

test('same story structure in every language (needed for English voice fallback)', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  const plan = planTomorrow(tasks, TODAY);
  const n = bcs(tasks, TODAY, plan, { lang: 'en' }).beats.length;
  for (const l of SCRIPT_LANGS) assert.equal(bcs(tasks, TODAY, plan, { lang: l }).beats.length, n, l);
});

test('activeness layout + voice choice', () => {
  assert.deepEqual(layoutFor('less').tabs, ['home', 'log', 'plan', 'video']);
  assert.equal(layoutFor('more').homeTips, true);
  assert.equal(layoutFor(undefined).tabs.length, 6);
  assert.equal(voiceLangFor('ta'), 'en');
  assert.equal(voiceLangFor('te'), 'te');
  assert.equal(defaultVoice('hi', 'male'), 'hi_IN-pratham-medium');
  assert.equal(defaultVoice('hi', ''), 'hi_IN-priyamvada-medium');
  assert.equal(defaultVoice('kn', 'male'), 'en_GB-alan-medium');
});

import { buildContext, pickModel, parseAnswer, shortAnswer, systemPrompt, looksLikeKey } from '../src/lib/chat.js';

test('chat context never leaks office/private titles or notes', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  tasks.push({ ...tasks[0], id: 'p2', title: 'Doctor visit SECRET', private: true, date: TODAY, status: 'skipped', note: 'my bank pin 1234' });
  tasks.push({ ...tasks[1], id: 'o2', title: 'Project Falcon review', area: 'office', private: true, date: TODAY, note: 'confidential client' });
  const ctx = buildContext(tasks, { name: 'Pritam', age: 30, lang: 'hi' }, TODAY);
  for (const secret of ['Audit queue', 'SOP doubt', 'Team standup', 'Email + Slack', 'SECRET', 'Falcon', 'bank pin', 'confidential']) {
    assert.ok(!ctx.includes(secret), `context leaked "${secret}"`);
  }
  assert.ok(ctx.includes('an office task'));
  assert.ok(ctx.includes('Morning walk')); // personal, non-private = ok
  assert.ok(ctx.includes('Pritam') && ctx.includes('streak'));
});

test('pickModel prefers newest plain flash model', () => {
  const gen = ['generateContent'];
  const models = [
    { name: 'models/gemini-1.5-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: gen },
    { name: 'models/gemini-3-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-3-pro', supportedGenerationMethods: gen },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  ];
  assert.equal(pickModel(models), 'gemini-3-flash');
  assert.equal(pickModel([]), 'gemini-3.8-flash');
  assert.equal(pickModel([{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: gen }, ...models]), 'gemini-3.8-flash');
});

test('parseAnswer skips thoughts; shortAnswer keeps it short', () => {
  const j = { candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }, { text: 'Subah 9 baje karo.' }] } }] };
  assert.equal(parseAnswer(j), 'Subah 9 baje karo.');
  assert.throws(() => parseAnswer({ candidates: [{ finishReason: 'SAFETY' }] }), /SAFETY/);
  const long = 'One. Two. Three. Four. Five. Six.';
  assert.equal(shortAnswer(long), 'One. Two. Three. Four.');
  assert.equal(shortAnswer('## Title\n**Bold** answer.'), 'Title Bold answer.');
  assert.ok(systemPrompt('ta').includes('Tamil'));
  assert.ok(systemPrompt('hi').includes('Hinglish'));
  assert.equal(looksLikeKey('short'), false);
  assert.equal(looksLikeKey('AIzaSyD-abcdefghijklmnopqrstuvwxyz12345'), true);
});

import { validPin, enableLock, unlock, saveEncrypted, disableLock, isLockEnabled, lockoutSeconds, resetEverything } from '../src/lib/lock.js';

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    dump: () => [...m.values()].join('\n'),
  };
}

test('lock: tasks are really encrypted, right PIN opens, wrong PIN fails', async () => {
  const s = memStore();
  s.setItem('persona.tasks.v1', JSON.stringify([{ title: 'SECRET DIARY' }]));
  const tasks = [{ id: 't1', title: 'SECRET DIARY' }];
  const key = await enableLock('2468', tasks, s);
  assert.ok(isLockEnabled(s));
  assert.equal(s.getItem('persona.tasks.v1'), null); // plain copy gayi
  assert.ok(!s.dump().includes('SECRET'), 'plain text found in storage');
  assert.ok(!s.dump().includes('2468'), 'PIN stored');

  const ok = await unlock('2468', s);
  assert.equal(ok.tasks[0].title, 'SECRET DIARY');
  await assert.rejects(unlock('1111', s), (e) => e.wrong === true);

  await saveEncrypted(key, [...tasks, { id: 't2', title: 'NEW ONE' }], s);
  assert.equal((await unlock('2468', s)).tasks.length, 2);
  assert.ok(!s.dump().includes('NEW ONE'));

  disableLock([{ id: 't1' }], s);
  assert.equal(isLockEnabled(s), false);
  assert.ok(s.getItem('persona.tasks.v1'));
});

test('lock: PIN rules + lockout after 5 wrong tries', async () => {
  assert.equal(validPin('123'), false);
  assert.equal(validPin('1234'), true);
  assert.equal(validPin('123456'), true);
  assert.equal(validPin('12a4'), false);
  const s = memStore();
  await enableLock('9999', [], s);
  const now = 1_000_000;
  for (let i = 0; i < 5; i += 1) await assert.rejects(unlock('0000', s, now));
  assert.equal(lockoutSeconds(s, now), 30);
  await assert.rejects(unlock('9999', s, now), (e) => e.wait === 30); // sahi PIN bhi wait mein nahi chalega
  assert.equal((await unlock('9999', s, now + 31_000)).tasks.length, 0);
  await assert.rejects(enableLock('12', [], s));
});

test('resetEverything removes only persona data', async () => {
  const s = memStore();
  s.setItem('persona.tasks.v1', '[]');
  s.setItem('persona.lock.v1', '{}');
  s.setItem('other.app', 'keep');
  await resetEverything(s);
  assert.equal(s.getItem('persona.tasks.v1'), null);
  assert.equal(s.getItem('other.app'), 'keep');
});

import { oneClickPrompt, googleAiUrl } from '../src/lib/chat.js';

test('one-click prompt: short, safe, language-aware, valid Google URL', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  tasks.push({ ...tasks[1], id: 'o3', title: 'Project Falcon review', area: 'office', private: true, date: TODAY, note: 'confidential' });
  const ctx = buildContext(tasks, { name: 'Pritam', lang: 'hi' }, TODAY);
  const p = oneClickPrompt('Mushkil kaam kab karun?', ctx, 'hi');
  assert.ok(p.includes('Hinglish') && p.includes('Mushkil kaam kab karun?'));
  for (const s of ['Falcon', 'confidential', 'Audit queue']) assert.ok(!p.includes(s), s);
  assert.ok(p.length < 1700, `prompt too long: ${p.length}`);
  const u = googleAiUrl(p);
  assert.ok(u.startsWith('https://www.google.com/search?udm=50&q='));
  assert.ok(u.length < 8000);
  assert.ok(oneClickPrompt('x', ctx, 'ta').includes('Tamil'));
});
