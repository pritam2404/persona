// Data browser ke localStorage mein save hota hai. Kahin upload nahi hota.
// Har device (phone / laptop) ka apna storage hai -> Export/Import se milao.

import { parseImport } from './model.js';
import { isoDate, addDays } from './time.js';

const KEY = 'persona.tasks.v1';
const SETTINGS_KEY = 'persona.settings.v1';
const PLAN_PREFIX = 'persona.plan.v1.';

export function loadTasks() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return parseImport(raw).tasks;
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(KEY, JSON.stringify(tasks));
}

export function loadSettings() {
  const defaults = {
    name: 'Pritam',
    lang: 'hi',
    theme: 'light',
    activity: 'medium',
    age: '',
    sex: '',
    onboarded: true,
    devMode: false,
    storyLang: '',
    nightReminderTime: '21:30', // Raat 9:30 baje
    nightReminderEnabled: true,
    nightReminderSound: true,
    morningBriefingSound: true,
    morningWakeTime: '06:30',
    lastReminderFiredDate: '',
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/**
 * Raat ki planning & subah ki priority list storage
 */
export function loadPrioritiesPlan(dateStr = isoDate()) {
  try {
    const raw = localStorage.getItem(`${PLAN_PREFIX}${dateStr}`);
    if (raw) {
      return JSON.parse(raw);
    }

    // Default sample priorities if opened for today and never planned
    const today = isoDate();
    if (dateStr === today) {
      const defaultPlan = {
        date: today,
        sealed: true,
        sealedAt: new Date(Date.now() - 3600000 * 9).toISOString(), // kal raat seal hua
        priorities: [
          {
            id: `p-${today}-1`,
            rank: 1,
            title: 'Core client presentation & pitch review',
            slot: 'morning',
            category: 'Deep work',
            area: 'office',
            estMin: 60,
            energy: 5,
            completed: false,
            completedAt: null,
          },
          {
            id: `p-${today}-2`,
            rank: 2,
            title: 'Sprint planning & key code architecture',
            slot: 'afternoon',
            category: 'Deep work',
            area: 'office',
            estMin: 45,
            energy: 4,
            completed: false,
            completedAt: null,
          },
          {
            id: `p-${today}-3`,
            rank: 3,
            title: '30-min brisk walk ya workout',
            slot: 'evening',
            category: 'Health',
            area: 'personal',
            estMin: 30,
            energy: 3,
            completed: false,
            completedAt: null,
          },
        ],
        notes: 'Kal focus deep work pe rakhna hai bina distraction.',
        gratitude: 'Team ne release acche se handle kiya.',
        wakeTime: '06:30',
        habits: {
          water: false,
          sunlight: false,
          noPhone: false,
        },
      };
      savePrioritiesPlan(today, defaultPlan);
      return defaultPlan;
    }

    // Default blank plan for tomorrow
    return {
      date: dateStr,
      sealed: false,
      sealedAt: null,
      priorities: [],
      notes: '',
      gratitude: '',
      wakeTime: '06:30',
      habits: {
        water: false,
        sunlight: false,
        noPhone: false,
      },
    };
  } catch {
    return {
      date: dateStr,
      sealed: false,
      sealedAt: null,
      priorities: [],
      notes: '',
      gratitude: '',
      wakeTime: '06:30',
      habits: {
        water: false,
        sunlight: false,
        noPhone: false,
      },
    };
  }
}

export function savePrioritiesPlan(dateStr, plan) {
  try {
    localStorage.setItem(`${PLAN_PREFIX}${dateStr}`, JSON.stringify(plan));
  } catch (e) {
    console.error('Failed to save priority plan', e);
  }
}

/** Browser mein ek file download karwata hai. */
export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
