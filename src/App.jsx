import { useEffect, useState } from 'react';
import { loadTasks, saveTasks, loadSettings, saveSettings, downloadFile } from './lib/storage.js';
import { parseImport, mergeTasks } from './lib/model.js';
import { isoDate } from './lib/time.js';
import { makeDemoTasks } from './lib/demo.js';
import LogView from './views/LogView.jsx';
import AnalyseView from './views/AnalyseView.jsx';
import PlanView from './views/PlanView.jsx';
import VideoView from './views/VideoView.jsx';
import VideosView from './views/VideosView.jsx';
import About from './views/About.jsx';
import HomeView from './views/HomeView.jsx';
import SettingsView from './views/SettingsView.jsx';

// Neeche wala tab bar (icon + chhota naam)
const TABS = [
  { id: 'home', label: 'Home', icon: '🏠', component: HomeView },
  { id: 'log', label: 'Aaj', icon: '✍️', component: LogView },
  { id: 'analyse', label: 'Analyse', icon: '📊', component: AnalyseView },
  { id: 'plan', label: 'Kal', icon: '🗓️', component: PlanView },
  { id: 'video', label: 'Story', icon: '🎬', component: VideoView },
  { id: 'videos', label: 'Videos', icon: '📁', component: VideosView },
];

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [settings, setSettings] = useState(loadSettings);
  const [tab, setTab] = useState('home');
  const [day, setDay] = useState(isoDate());
  const [toast, setToast] = useState('');
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Theme: <html data-theme="dark"> + phone ka status bar colour
  const theme = settings.theme || 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#6366f1');
  }, [theme]);

  const hasDemo = tasks.some((t) => t.id.startsWith('demo-'));

  function goTo(id) {
    setTab(id);
    setShowAbout(false);
    window.scrollTo({ top: 0 });
  }

  async function exportData() {
    const payload = { app: 'persona', version: 1, exportedAt: new Date().toISOString(), tasks };
    const name = `persona-backup-${isoDate()}.persona.json`;
    const json = JSON.stringify(payload, null, 2);
    // Phone pe: seedha share sheet (WhatsApp "Message yourself" / Drive) -> doosre device pe Import
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Persona backup' });
        setToast(`${tasks.length} tasks ka backup share hua`);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // user ne cancel kiya
      }
    }
    downloadFile(name, json);
    setToast(`${tasks.length} tasks ka backup download hua`);
  }

  async function importData(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = parseImport(await file.text());
    if (r.error) {
      setToast(`Import fail: ${r.error}`);
      return;
    }
    setTasks((prev) => mergeTasks(prev, r.tasks));
    setToast(`${r.tasks.length} tasks mile${r.rejected ? `, ${r.rejected} galat skip` : ''}`);
  }

  function toggleDemo() {
    if (hasDemo) {
      setTasks((prev) => prev.filter((t) => !t.id.startsWith('demo-')));
      setToast('Demo data hata diya');
    } else {
      setTasks((prev) => mergeTasks(prev, makeDemoTasks(isoDate())));
      setDay(isoDate());
      setToast('10 din ka demo data joda (asli data safe hai)');
    }
  }

  const Active = tab === 'settings' ? null : TABS.find((t) => t.id === tab).component;
  const shared = { tasks, setTasks, day, setDay, settings, setSettings, notify: setToast, goTo };

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="brand link-reset" onClick={() => goTo('home')} aria-label="Home">
          <img src="./icon-192.png" alt="" />
          <span>
            <span className="brand-name">Persona</span>
            <small>Aaj likho · Kal behtar</small>
          </span>
        </button>
        <div className="row">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSettings({ ...settings, theme: theme === 'dark' ? 'light' : 'dark' })}
            aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            title="Theme badlo"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'icon-btn on' : 'icon-btn'}
            onClick={() => goTo('settings')}
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="content">
        {showAbout && <About onClose={() => setShowAbout(false)} />}
        {tab === 'settings' ? (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            hasDemo={hasDemo}
            onToggleDemo={toggleDemo}
            onBackup={exportData}
            onImport={importData}
            onAbout={() => { setShowAbout(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            notify={setToast}
          />
        ) : (
          <Active key={tab} {...shared} />
        )}
      </main>

      <div className="toast" role="status" aria-live="polite">{toast}</div>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => goTo(t.id)}
          >
            <span className="ti" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
