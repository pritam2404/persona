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

test('coach script never leaks office/private titles', () => {
  const tasks = makeDemoTasks(TODAY, 10);
  tasks.push({ ...tasks[0], id: 'p1', title: 'Doctor visit SECRET', private: true, date: TODAY, status: 'skipped' });
  const plan = planTomorrow(tasks, TODAY);
  for (const lang of ['hi', 'en']) {
    const txt = toScriptTxt(buildCoachScript(tasks, TODAY, plan, { lang, name: 'Pritam' }));
    for (const secret of ['Audit queue', 'SOP doubt', 'Team standup', 'Email + Slack', 'SECRET']) {
      assert.ok(!txt.includes(secret), `${lang} script leaked "${secret}"`);
    }
    assert.ok(txt.includes('Pritam'));
  }
});
