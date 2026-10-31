// Data browser ke localStorage mein save hota hai. Kahin upload nahi hota.
// Har device (phone / laptop) ka apna storage hai -> Export/Import se milao.

import { parseImport } from './model.js';
import { isoDate, addDays, durationMin } from './time.js';
import { tasksOn } from './analyze.js';
import { planTomorrow } from './predict.js';

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
 * Generate dynamic priority plan based on user's real task data and chosen language
 */
export function generateDynamicPlanForDate(dateStr, tasks = [], lang = 'hi') {
  const prevDate = addDays(dateStr, -1);
  const prevTasks = tasksOn(tasks, prevDate);

  // 1. Incomplete / skipped tasks from previous day become top priorities
  const carryovers = prevTasks.filter((t) => t.status === 'partial' || t.status === 'skipped');

  // 2. High-confidence routine habits from predict engine
  const predicted = planTomorrow(tasks, prevDate);

  const dynamicPriorities = [];

  // Add carryovers first
  carryovers.slice(0, 2).forEach((t, idx) => {
    let prefix = '(Carryover)';
    if (lang === 'bn') prefix = '(আগের দিনের বাকি)';
    else if (lang === 'hi') prefix = '(Pichhle din ka baaki)';

    dynamicPriorities.push({
      id: `p-${dateStr}-carry-${t.id || idx}`,
      rank: dynamicPriorities.length + 1,
      title: `${prefix} ${t.title}`,
      slot: t.start < '12:00' ? 'morning' : t.start < '17:00' ? 'afternoon' : 'evening',
      category: t.category || 'Deep work',
      area: t.area || 'office',
      estMin: durationMin(t.start, t.end) || 45,
      energy: 5,
      completed: false,
      completedAt: null,
      note: 'Previous unfinished priority',
    });
  });

  // Add predicted routine habits if slots remain
  predicted.items.forEach((item, idx) => {
    if (dynamicPriorities.length >= 3) return;
    const exists = dynamicPriorities.some((p) => p.title.toLowerCase().includes(item.title.toLowerCase()));
    if (!exists) {
      dynamicPriorities.push({
        id: `p-${dateStr}-pred-${idx}`,
        rank: dynamicPriorities.length + 1,
        title: item.title,
        slot: item.start < '12:00' ? 'morning' : item.start < '17:00' ? 'afternoon' : 'evening',
        category: item.category || 'Deep work',
        area: 'office',
        estMin: durationMin(item.start, item.end) || 60,
        energy: item.focus ? 5 : 3,
        completed: false,
        completedAt: null,
        note: item.reason || '',
      });
    }
  });

  // Fallback defaults if user has 0 tasks logged yet, customized by language
  if (dynamicPriorities.length === 0) {
    if (lang === 'bn') {
      dynamicPriorities.push(
        {
          id: `p-${dateStr}-1`,
          rank: 1,
          title: 'প্রধান ফোকাস কাজ ও ডিপ ওয়ার্ক',
          slot: 'morning',
          category: 'Deep work',
          area: 'office',
          estMin: 60,
          energy: 5,
          completed: false,
          completedAt: null,
          note: 'সকালে সবচেয়ে জরুরি কাজ আগে শেষ করব',
        },
        {
          id: `p-${dateStr}-2`,
          rank: 2,
          title: 'গুরুত্বপূর্ণ প্ল্যানিং ও পর্যালোচনা',
          slot: 'afternoon',
          category: 'Deep work',
          area: 'office',
          estMin: 45,
          energy: 4,
          completed: false,
          completedAt: null,
          note: '',
        },
        {
          id: `p-${dateStr}-3`,
          rank: 3,
          title: '৩০ মিনিট শরীরচর্চা বা মুক্ত বাতাস',
          slot: 'evening',
          category: 'Health',
          area: 'personal',
          estMin: 30,
          energy: 3,
          completed: false,
          completedAt: null,
          note: '',
        }
      );
    } else if (lang === 'hi') {
      dynamicPriorities.push(
        {
          id: `p-${dateStr}-1`,
          rank: 1,
          title: 'Core client presentation & pitch review',
          slot: 'morning',
          category: 'Deep work',
          area: 'office',
          estMin: 60,
          energy: 5,
          completed: false,
          completedAt: null,
          note: 'Subah sabse zaroori kaam pehle khatam karein',
        },
        {
          id: `p-${dateStr}-2`,
          rank: 2,
          title: 'Sprint planning & key code architecture',
          slot: 'afternoon',
          category: 'Deep work',
          area: 'office',
          estMin: 45,
          energy: 4,
          completed: false,
          completedAt: null,
          note: '',
        },
        {
          id: `p-${dateStr}-3`,
          rank: 3,
          title: '30-min brisk walk ya gym session',
          slot: 'evening',
          category: 'Health',
          area: 'personal',
          estMin: 30,
          energy: 3,
          completed: false,
          completedAt: null,
          note: '',
        }
      );
    } else {
      dynamicPriorities.push(
        {
          id: `p-${dateStr}-1`,
          rank: 1,
          title: 'Core client presentation & pitch review',
          slot: 'morning',
          category: 'Deep work',
          area: 'office',
          estMin: 60,
          energy: 5,
          completed: false,
          completedAt: null,
          note: 'Tackle the most impactful priority first',
        },
        {
          id: `p-${dateStr}-2`,
          rank: 2,
          title: 'Architecture & code review execution',
          slot: 'afternoon',
          category: 'Deep work',
          area: 'office',
          estMin: 45,
          energy: 4,
          completed: false,
          completedAt: null,
          note: '',
        },
        {
          id: `p-${dateStr}-3`,
          rank: 3,
          title: '30-min brisk walk or workout',
          slot: 'evening',
          category: 'Health',
          area: 'personal',
          estMin: 30,
          energy: 3,
          completed: false,
          completedAt: null,
          note: '',
        }
      );
    }
  }

  // Language-specific default notes
  let defaultNotes = 'Bina distraction focus rakhna hai.';
  let defaultGratitude = 'Shanti se din shuru kiya.';

  if (lang === 'bn') {
    defaultNotes = 'মনোযোগ দিয়ে মূল কাজটি সম্পন্ন করতে হবে।';
    defaultGratitude = 'আজকের সুযোগের জন্য কৃতজ্ঞতা ও স্থির মন।';
  } else if (lang === 'en') {
    defaultNotes = 'Execute on non-negotiable priorities without distraction.';
    defaultGratitude = 'Grateful for mental clarity and forward momentum.';
  }

  return {
    date: dateStr,
    sealed: dateStr === isoDate(), // sealed if today
    sealedAt: dateStr === isoDate() ? new Date(Date.now() - 3600000 * 8).toISOString() : null,
    priorities: dynamicPriorities,
    notes: defaultNotes,
    gratitude: defaultGratitude,
    wakeTime: '06:30',
    habits: {
      water: false,
      sunlight: false,
      noPhone: false,
    },
  };
}

/**
 * Raat ki planning & subah ki priority list storage
 */
export function loadPrioritiesPlan(dateStr = isoDate(), tasks = [], lang = 'hi') {
  try {
    const raw = localStorage.getItem(`${PLAN_PREFIX}${dateStr}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If plan already exists and has priorities, return it
      if (parsed && Array.isArray(parsed.priorities) && parsed.priorities.length > 0) {
        return parsed;
      }
    }

    // Generate dynamic data-based plan
    const generated = generateDynamicPlanForDate(dateStr, tasks, lang);
    savePrioritiesPlan(dateStr, generated);
    return generated;
  } catch {
    return generateDynamicPlanForDate(dateStr, tasks, lang);
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
