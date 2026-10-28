import { useEffect, useRef, useState } from 'react';
import { loadTasks, saveTasks, loadSettings, saveSettings, downloadFile } from './lib/storage.js';
import { isLockEnabled, encryptJSON } from './lib/lock.js';
import LockScreen from './views/LockScreen.jsx';
import LockSettings from './views/LockSettings.jsx';

const encryptForSave = async (key, tasks) => JSON.stringify(await encryptJSON(key, tasks));
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
import Onboarding from './views/Onboarding.jsx';
import { makeT } from './lib/i18n.js';
import { layoutFor } from './lib/dashboard.js';
import ChatPanel from './views/ChatPanel.jsx';

// Neeche wala tab bar (icon + chhota naam, naam bhasha ke hisaab se)
const TABS = [
  { id: 'home', key: 'tab_home', icon: '🏠', component: HomeView },
  { id: 'log', key: 'tab_log', icon: '✍️', component: LogView },
  { id: 'analyse', key: 'tab_analyse', icon: '📊', component: AnalyseView },
  { id: 'plan', key: 'tab_plan', icon: '🗓️', component: PlanView },
  { id: 'video', key: 'tab_story', icon: '🎬', component: VideoView },
  { id: 'videos', key: 'tab_videos', icon: '📁', component: VideosView },
];

const AUTO_LOCK_MS = 60 * 1000; // app 1 min background mein raha -> wapas aane pe PIN

export default function App() {
  // Lock on ho to tasks memory mein tabhi aate hain jab PIN sahi ho
  const [lockOn, setLockOn] = useState(isLockEnabled);
  const [locked, setLocked] = useState(isLockEnabled);
  const keyRef = useRef(null);
  const saveSeq = useRef(0);
  const [tasks, setTasks] = useState(() => (isLockEnabled() ? [] : loadTasks()));
  const [settings, setSettings] = useState(loadSettings);
  const [tab, setTab] = useState('home');
  const [day, setDay] = useState(isoDate());
  const [toast, setToast] = useState('');
  const [showAbout, setShowAbout] = useState(false);

  // Save: lock on -> encrypted (sirf unlocked hone pe), warna plain
  useEffect(() => {
    if (locked) return; // locked = memory khaali hai, kabhi overwrite mat karo
    if (lockOn && keyRef.current) {
      const seq = ++saveSeq.current;
      const key = keyRef.current;
      // purana save naye ke baad khatam ho to bhi naya hi bache: sirf latest likho
      encryptForSave(key, tasks).then((blob) => {
        if (seq === saveSeq.current && keyRef.current === key) localStorage.setItem('persona.tasks.enc.v1', blob);
      });
    } else if (!lockOn) {
      saveTasks(tasks);
    }
  }, [tasks, locked, lockOn]);

  // Auto-lock: app chhupa (dusri app / screen off) 1 min se zyada -> lock
  useEffect(() => {
    if (!lockOn) return undefined;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) {
        keyRef.current = null;
        setLocked(true);
        setTasks([]);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [lockOn]);
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

  const t = makeT(settings.lang);
  useEffect(() => { document.documentElement.lang = settings.lang || 'hi'; }, [settings.lang]);

  // Activeness: "kam" wale ko kam tabs (simple app)
  const layout = layoutFor(settings.activity);
  const visibleTabs = TABS.filter((x) => layout.tabs.includes(x.id));
  useEffect(() => {
    if (tab !== 'settings' && !layout.tabs.includes(tab)) setTab('home');
  }, [tab, layout.tabs]);

  const hasDemo = tasks.some((x) => x.id.startsWith('demo-'));

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

  const Active = tab === 'settings' ? null : (TABS.find((x) => x.id === tab) || TABS[0]).component;
  const shared = { tasks, setTasks, day, setDay, settings, setSettings, notify: setToast, goTo, t, layout };

  // App lock: sabse pehle PIN
  if (lockOn && locked) {
    return (
      <LockScreen
        t={t}
        onUnlocked={(key, unlockedTasks) => {
          keyRef.current = key;
          setTasks(unlockedTasks);
          setLocked(false);
        }}
      />
    );
  }

  // Pehli baar: setup screens (bhasha, naam, umar/gender, activeness)
  if (!settings.onboarded) {
    return (
      <Onboarding
        settings={settings}
        onDone={(profile) => { setSettings((s) => ({ ...s, ...profile })); setTab('home'); }}
      />
    );
  }

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="brand link-reset" onClick={() => goTo('home')} aria-label="Home">
          <img src="./icon-192.png" alt="" />
          <span>
            <span className="brand-name">Persona</span>
            <small>{t('tagline')}</small>
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
            t={t}
            settings={settings}
            setSettings={setSettings}
            hasDemo={hasDemo}
            onToggleDemo={toggleDemo}
            onBackup={exportData}
            onImport={importData}
            onAbout={() => { setShowAbout(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            notify={setToast}
            lockSlot={(
              <LockSettings
                t={t}
                enabled={lockOn}
                tasks={tasks}
                notify={setToast}
                onEnabled={(key) => { keyRef.current = key; setLockOn(true); }}
                onDisabled={() => { keyRef.current = null; setLockOn(false); }}
              />
            )}
          />
        ) : (
          <Active key={tab} {...shared} />
        )}
      </main>

      <div className="toast" role="status" aria-live="polite">{toast}</div>

      <ChatPanel t={t} tasks={tasks} settings={settings} />

      <nav className="tabs" role="tablist" aria-label="Sections" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
        {visibleTabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            className={tab === x.id ? 'tab active' : 'tab'}
            onClick={() => goTo(x.id)}
          >
            <span className="ti" aria-hidden="true">{x.icon}</span>
            {t(x.key)}
          </button>
        ))}
      </nav>
    </div>
  );
}
