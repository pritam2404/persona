// Demo data: app try karne ke liye 10 din ka nakli (fake) data.
// Real data se mix nahi hota - har demo task ki id "demo-" se shuru hoti hai.

import { addDays } from './time.js';

const DAY = [
  // [title, area, category, start, end, estMin, energy, status]
  ['Morning walk', 'personal', 'Health', '07:00', '07:30', 30, 3, 'done'],
  ['Audit queue', 'office', 'Deep work', '09:30', '11:30', 90, 4, 'done'],
  ['Team standup', 'office', 'Meetings', '11:30', '12:00', 15, 3, 'done'],
  ['Email + Slack', 'office', 'Admin', '12:00', '13:00', 30, 2, 'done'],
  ['SOP doubt review', 'office', 'Deep work', '14:00', '15:30', 60, 2, 'partial'],
  ['Python practice', 'personal', 'Study', '21:00', '21:45', 45, 2, 'done'],
  ['Shorts video script', 'personal', 'Side project', '22:00', '22:30', 30, 2, 'skipped'],
];

export function makeDemoTasks(today, days = 10) {
  const tasks = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    DAY.forEach(([title, area, category, start, end, estMin, energy, status], j) => {
      // thoda variation taaki pattern real lage
      let st = status;
      if (title === 'Morning walk' && i % 3 === 0) st = 'skipped';
      if (title === 'Shorts video script' && i % 4 === 0) st = 'done';
      tasks.push({
        id: `demo-${date}-${j}`,
        date, title, area, category, start, end, estMin,
        energy: title === 'Audit queue' && i % 2 ? 5 : energy,
        status: st,
        note: '',
        private: area === 'office',
      });
    });
  }
  return tasks;
}
