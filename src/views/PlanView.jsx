import { useState, useEffect } from 'react';
import { planTomorrow } from '../lib/predict.js';
import { durationMin, fmtDuration, isoDate, addDays } from '../lib/time.js';
import { loadPrioritiesPlan, savePrioritiesPlan } from '../lib/storage.js';
import { soundEngine } from '../utils/audio.ts';
import { fireConfetti } from '../utils/confetti.ts';
import VoicePriorityRecorder from '../components/VoicePriorityRecorder.jsx';

const CONF = { low: 'Kam bharosa', medium: 'Theek bharosa', high: 'Achha bharosa' };

export default function PlanView({
  tasks,
  day,
  settings,
  setSettings,
  notify,
  t,
  triggerTestReminder,
}) {
  const tomorrowDate = addDays(isoDate(), 1);
  const [targetDate, setTargetDate] = useState(tomorrowDate);
  const [planData, setPlanData] = useState(() => loadPrioritiesPlan(tomorrowDate, tasks, settings?.lang));
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  // Automated suggestions based on past habits
  const suggestedPlan = planTomorrow(tasks, day);

  // Form state for adding custom priority
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [slot, setSlot] = useState('morning');
  const [category, setCategory] = useState('Deep work');
  const [estMin, setEstMin] = useState(60);
  const [energy, setEnergy] = useState(5);
  const [notes, setNotes] = useState('');

  // Sync planData when targetDate changes or language changes
  useEffect(() => {
    setPlanData(loadPrioritiesPlan(targetDate, tasks, settings?.lang));
  }, [targetDate, settings?.lang]);

  function handleSavePlan(updated) {
    setPlanData(updated);
    savePrioritiesPlan(targetDate, updated);
  }

  function handleVoiceAddPriorities(items) {
    const priorities = planData.priorities || [];
    const newItems = items.map((it, idx) => ({
      ...it,
      id: `p-${targetDate}-${Date.now().toString(36)}-${idx}`,
      rank: priorities.length + idx + 1,
    }));
    const updated = {
      ...planData,
      priorities: [...priorities, ...newItems],
    };
    handleSavePlan(updated);
    notify(`🎙️ ${newItems.length} priorities voice se jodi gayi!`);
  }

  function handleAddPriority(e) {
    e.preventDefault();
    if (!title.trim()) return;

    const priorities = planData.priorities || [];
    const newPriority = {
      id: `p-${targetDate}-${Date.now().toString(36)}`,
      rank: priorities.length + 1,
      title: title.trim(),
      slot,
      category,
      area: category === 'Health' || category === 'Family' ? 'personal' : 'office',
      estMin: Number(estMin) || 45,
      energy: Number(energy) || 4,
      completed: false,
      completedAt: null,
      note: notes.trim(),
    };

    const updated = {
      ...planData,
      priorities: [...priorities, newPriority],
    };

    handleSavePlan(updated);
    setTitle('');
    setNotes('');
    setIsAdding(false);
    notify('Kal ke liye priority jodi gayi');
  }

  function handlePromoteSuggestion(suggestedItem) {
    const priorities = planData.priorities || [];
    const alreadyExists = priorities.some((p) => p.title.toLowerCase() === suggestedItem.title.toLowerCase());
    if (alreadyExists) {
      notify('Ye task pehle se priorities mein hai');
      return;
    }

    const newPriority = {
      id: `p-${targetDate}-${Date.now().toString(36)}`,
      rank: priorities.length + 1,
      title: suggestedItem.title,
      slot: suggestedItem.start < '12:00' ? 'morning' : suggestedItem.start < '17:00' ? 'afternoon' : 'evening',
      category: suggestedItem.category || 'Deep work',
      area: 'office',
      estMin: durationMin(suggestedItem.start, suggestedItem.end) || 45,
      energy: suggestedItem.focus ? 5 : 3,
      completed: false,
      completedAt: null,
      note: suggestedItem.reason || '',
    };

    const updated = {
      ...planData,
      priorities: [...priorities, newPriority],
    };

    handleSavePlan(updated);
    notify(`"${suggestedItem.title}" kal ki priority mein joda gaya!`);
  }

  function handleRemovePriority(id) {
    const updatedPriorities = (planData.priorities || [])
      .filter((p) => p.id !== id)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    handleSavePlan({ ...planData, priorities: updatedPriorities });
    notify('Priority hata di gayi');
  }

  function handleMoveRank(index, direction) {
    const list = [...(planData.priorities || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const reordered = list.map((p, idx) => ({ ...p, rank: idx + 1 }));
    handleSavePlan({ ...planData, priorities: reordered });
  }

  function handleSealPlan() {
    const nowSealed = !planData.sealed;
    if (nowSealed) {
      soundEngine.playEveningChime(settings?.nightReminderSound !== false);
      fireConfetti();
      notify('🌙 Kal ka plan seal ho gaya! Ab sukoon se soiye.');
    } else {
      notify('Plan unseal ho gaya — aap badlaav kar sakte hain');
    }

    const updated = {
      ...planData,
      sealed: nowSealed,
      sealedAt: nowSealed ? new Date().toISOString() : null,
    };
    handleSavePlan(updated);
  }

  const priorities = planData?.priorities || [];

  return (
    <section aria-labelledby="plan-h">
      {/* 1. Header & Date Switcher */}
      <div className="hero" style={{ marginBottom: 16 }}>
        <h2 id="plan-h">🌙 {t('night_reminder_title')}</h2>
        <p className="muted">{t('night_reminder_sub')}</p>
      </div>

      {/* 2. Evening Reminder Settings Quick Card */}
      <div className="card" style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--line)',
        marginBottom: 16,
      }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: '1.25rem' }}>⏰</span>
            <div>
              <strong style={{ fontSize: '0.98rem' }}>Raat Ka Reminder Alert</strong>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                Har raat planning ke liye reminder notification aayega
              </div>
            </div>
          </div>
          <label className="chip" style={{ cursor: 'pointer', padding: '4px 10px' }}>
            <input
              type="checkbox"
              checked={Boolean(settings?.nightReminderEnabled)}
              onChange={(e) => setSettings({ ...settings, nightReminderEnabled: e.target.checked })}
            />
            {settings?.nightReminderEnabled ? '✓ Chalu' : 'Band'}
          </label>
        </div>

        {settings?.nightReminderEnabled && (
          <div className="row wrap" style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
            <label className="block" style={{ fontSize: '0.85rem' }}>
              <span>Reminder Time:</span>
              <input
                type="time"
                value={settings?.nightReminderTime || '21:30'}
                onChange={(e) => setSettings({ ...settings, nightReminderTime: e.target.value })}
                style={{ width: 130, padding: '4px 8px' }}
              />
            </label>
            <div className="row" style={{ gap: 8, marginTop: 18 }}>
              <button
                type="button"
                className="ghost sm"
                onClick={() => {
                  soundEngine.playEveningChime(true);
                  if (triggerTestReminder) triggerTestReminder();
                  notify('🔔 Test reminder bajaya gaya!');
                }}
              >
                🔊 {t('night_reminder_test')}
              </button>
              {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <button
                  type="button"
                  className="ghost sm"
                  onClick={() => {
                    Notification.requestPermission().then((p) => {
                      if (p === 'granted') notify('Browser notification activate ho gaya');
                    });
                  }}
                >
                  🔔 Browser Push On Karein
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Target Date Indicator */}
      <div className="card" style={{
        background: planData.sealed ? 'var(--ok-soft)' : 'var(--surface)',
        border: planData.sealed ? '1.5px solid var(--ok)' : '1px solid var(--line)',
        marginBottom: 16,
      }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Planning For:
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 800 }}>
              {targetDate === tomorrowDate ? `Kal (${targetDate})` : targetDate}
            </h3>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`chip ${targetDate === tomorrowDate ? 'on' : ''}`}
              onClick={() => setTargetDate(tomorrowDate)}
            >
              Kal
            </button>
            <button
              type="button"
              className={`chip ${targetDate === isoDate() ? 'on' : ''}`}
              onClick={() => setTargetDate(isoDate())}
            >
              Aaj
            </button>
            <button
              type="button"
              className={`chip ${targetDate === addDays(tomorrowDate, 1) ? 'on' : ''}`}
              onClick={() => setTargetDate(addDays(tomorrowDate, 1))}
            >
              Parso
            </button>
          </div>
        </div>

        {planData.sealed && (
          <div style={{
            marginTop: 10,
            padding: '6px 12px',
            background: 'rgba(16, 185, 129, 0.15)',
            borderRadius: 8,
            fontSize: '0.85rem',
            color: 'var(--ok)',
            fontWeight: 600,
          }}>
            🔒 Plan seal ho chuka hai ({planData.sealedAt ? new Date(planData.sealedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}). Subah seedha execution shuru karein!
          </div>
        )}
      </div>

      {/* 4. Top 3 Non-Negotiable Priorities */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🎯 Top Priorities (Non-Negotiable)</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
              Ivy Lee Rule: Kal ke sabse prabhavi 3 kaam chuniye.
            </p>
          </div>
          {!planData.sealed && (
            <div className="row wrap" style={{ gap: 6 }}>
              <button
                type="button"
                className="chip on"
                onClick={() => setShowVoiceRecorder(true)}
                style={{
                  fontSize: '0.82rem',
                  padding: '4px 10px',
                  background: 'var(--grad-fire)',
                  cursor: 'pointer',
                }}
                title="Voice Note"
              >
                {t('voice_record_btn')}
              </button>
              <button
                type="button"
                className="primary sm"
                onClick={() => setIsAdding(true)}
              >
                + Naya Kaam
              </button>
            </div>
          )}
        </div>

        {/* Priority List */}
        {priorities.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--surface-2)',
            borderRadius: 12,
            margin: '8px 0',
          }}>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
              Abhi tak kal ke liye koi priority add nahi hui hai.
            </p>
            <button
              type="button"
              className="ghost sm"
              onClick={() => setIsAdding(true)}
            >
              + Kal Ka Pehla Kaam Set Karein
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0' }}>
            {priorities.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                {/* Rank Badge */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  background: item.rank === 1 ? 'var(--grad-fire)' : 'var(--line)',
                  color: item.rank === 1 ? '#fff' : 'var(--text)',
                  flexShrink: 0,
                }}>
                  #{item.rank || idx + 1}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word' }}>
                    {item.title}
                  </div>
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                    <span>{item.slot ? `${item.slot} focus` : ''}</span>
                    {item.estMin ? ` · ~${item.estMin} min` : ''}
                    {item.category ? ` · ${item.category}` : ''}
                    {item.note ? ` · ${item.note}` : ''}
                  </div>
                </div>

                {/* Reorder & Remove Actions */}
                {!planData.sealed && (
                  <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleMoveRank(idx, -1)}
                      disabled={idx === 0}
                      style={{ fontSize: '0.8rem', padding: '2px 6px', opacity: idx === 0 ? 0.3 : 1 }}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleMoveRank(idx, 1)}
                      disabled={idx === priorities.length - 1}
                      style={{ fontSize: '0.8rem', padding: '2px 6px', opacity: idx === priorities.length - 1 ? 0.3 : 1 }}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleRemovePriority(item.id)}
                      style={{ fontSize: '0.8rem', color: 'var(--bad)', padding: '2px 6px' }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Priority Inline Modal/Form */}
        {isAdding && (
          <form
            onSubmit={handleAddPriority}
            style={{
              marginTop: 14,
              padding: 14,
              background: 'var(--surface-2)',
              borderRadius: 12,
              border: '1.5px dashed var(--accent)',
            }}
          >
            <h4 style={{ margin: '0 0 10px', fontSize: '0.98rem' }}>+ Kal Ka Naya Priority Kaam</h4>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kaam ka naam (jaise: Core presentation finish karein)"
                required
                autoFocus
                style={{ width: '100%' }}
              />
            </div>

            <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
              <label className="block" style={{ flex: 1, minWidth: 130 }}>
                <span style={{ fontSize: '0.78rem' }}>Time Slot:</span>
                <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                  <option value="morning">Subah (Morning Focus)</option>
                  <option value="afternoon">Dopahar (Afternoon)</option>
                  <option value="evening">Shaam (Evening)</option>
                </select>
              </label>

              <label className="block" style={{ flex: 1, minWidth: 130 }}>
                <span style={{ fontSize: '0.78rem' }}>Category:</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Deep work">Deep work</option>
                  <option value="Study">Study</option>
                  <option value="Side project">Side project</option>
                  <option value="Health">Health</option>
                  <option value="Meetings">Meetings</option>
                  <option value="Admin">Admin</option>
                  <option value="Family">Family</option>
                </select>
              </label>

              <label className="block" style={{ width: 90 }}>
                <span style={{ fontSize: '0.78rem' }}>Time (min):</span>
                <input
                  type="number"
                  value={estMin}
                  onChange={(e) => setEstMin(e.target.value)}
                  min="5"
                  max="480"
                />
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note ya pehla step..."
                style={{ width: '100%' }}
              />
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button type="submit" className="primary sm">
                Jodein (Save Priority)
              </button>
              <button type="button" className="ghost sm" onClick={() => setIsAdding(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 5. Suggestions from Persona's Routine AI */}
      {suggestedPlan.items.length > 0 && !planData.sealed && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem' }}>
            💡 Persona Suggestions (Pichhle data se)
          </h4>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.78rem' }}>
            Aapke pattern ke hisaab se kal yeh kaam banta hai. Ek tap mein priority banayein:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestedPlan.items.slice(0, 3).map((item) => (
              <div
                key={item.start + item.title}
                className="row between"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  fontSize: '0.88rem',
                }}
              >
                <div>
                  <strong>{item.title}</strong>
                  <span className="muted"> · {item.start}–{item.end} · {item.category}</span>
                </div>
                <button
                  type="button"
                  className="ghost sm"
                  onClick={() => handlePromoteSuggestion(item)}
                  style={{ fontSize: '0.78rem' }}
                >
                  + Priority Banayein
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Night Wind-Down & Gratitude */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>🌙 Raat Ka Wind-Down & Sankalp</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="block">
            <span style={{ fontSize: '0.85rem' }}>Kal Subah Uthne Ka Target Time:</span>
            <input
              type="time"
              value={planData.wakeTime || '06:30'}
              disabled={planData.sealed}
              onChange={(e) => handleSavePlan({ ...planData, wakeTime: e.target.value })}
              style={{ width: 140 }}
            />
          </label>

          <label className="block">
            <span style={{ fontSize: '0.85rem' }}>Aaj Ka Ek Win / Kal Ka Ek Sankalp:</span>
            <input
              type="text"
              value={planData.gratitude || ''}
              disabled={planData.sealed}
              onChange={(e) => handleSavePlan({ ...planData, gratitude: e.target.value })}
              placeholder="Aaj kya accha raha ya kal kis mindset se jaana hai..."
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </div>

      {/* 7. Big Action: Seal Tomorrow's Plan */}
      <div style={{ textAlign: 'center', margin: '20px 0 30px' }}>
        <button
          type="button"
          className="primary"
          onClick={handleSealPlan}
          style={{
            fontSize: '1.05rem',
            padding: '12px 28px',
            borderRadius: 14,
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
          }}
        >
          {planData.sealed ? '🔓 Plan Unseal Karein (Edit)' : '🔒 Kal Ka Plan Pakka Karein (Seal Plan)'}
        </button>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          {planData.sealed
            ? 'Plan lock hai. Subah Persona aapko yeh priorities screen par dikhayega!'
            : 'Plan seal karte hi dimaag khali ho jayega aur aap shanti se so sakenge.'}
        </p>
      </div>

      {/* Voice Priority Recorder Modal */}
      {showVoiceRecorder && (
        <VoicePriorityRecorder
          isOpen={showVoiceRecorder}
          onClose={() => setShowVoiceRecorder(false)}
          onAddPriorities={handleVoiceAddPriorities}
          lang={settings?.lang}
          t={t}
        />
      )}
    </section>
  );
}
