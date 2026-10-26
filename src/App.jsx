import { useEffect, useRef, useState } from 'react';
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

const TABS = [
  { id: 'home', label: 'Home', component: HomeView },
  { id: 'log', label: 'Aaj', component: LogView },
  { id: 'analyse', label: 'Analyse', component: AnalyseView },
  { id: 'plan', label: 'Kal', component: PlanView },
  { id: 'video', label: 'Script', component: VideoView },
  { id: 'videos', label: 'Videos', component: VideosView },
];

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [settings, setSettings] = useState(loadSettings);
  const [tab, setTab] = useState('home');
  const [day, setDay] = useState(isoDate());
  const [toast, setToast] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const hasDemo = tasks.some((t) => t.id.startsWith('demo-'));

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
        // share fail -> neeche normal download
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

  const Active = TABS.find((t) => t.id === tab).component;

  return (
    <div className="app">
      <header className="top">
        <h1>Persona</h1>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={toggleDemo}>
            {hasDemo ? 'Demo hatao' : 'Demo data'}
          </button>
          <button type="button" className="ghost" onClick={exportData} title="Backup file banao / share karo">Backup</button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={importData}
            aria-label="Backup file import karo"
          />
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {showAbout && <About onClose={() => setShowAbout(false)} />}
        <Active
          tasks={tasks}
          setTasks={setTasks}
          day={day}
          setDay={setDay}
          settings={settings}
          setSettings={setSettings}
          notify={setToast}
          goTo={(id) => { setTab(id); window.scrollTo({ top: 0 }); }}
        />
      </main>

      <div className="toast" role="status" aria-live="polite">{toast}</div>
      <footer className="foot">
        Data sirf is device pe hai. Doosre device pe: Backup → WhatsApp/Drive → wahan Import.
        {' · '}
        <button
          type="button"
          className="link-btn"
          onClick={() => { setShowAbout(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          About · Made by Pritam
        </button>
      </footer>
    </div>
  );
}
