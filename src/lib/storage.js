// Data browser ke localStorage mein save hota hai. Kahin upload nahi hota.
// Har device (phone / laptop) ka apna storage hai -> Export/Import se milao.

import { parseImport } from './model.js';

const KEY = 'persona.tasks.v1';
const SETTINGS_KEY = 'persona.settings.v1';

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
    name: '', lang: 'hi', theme: 'light', activity: 'medium', age: '', sex: '',
    onboarded: false, devMode: false, storyLang: '',
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
