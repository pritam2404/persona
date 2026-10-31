import { useState } from 'react';
import { soundEngine } from '../utils/audio.ts';
import { fireConfetti } from '../utils/confetti.ts';
import { isoDate, addDays } from '../lib/time.js';
import { loadPrioritiesPlan, savePrioritiesPlan } from '../lib/storage.js';
import FocusTimerModal from './FocusTimerModal.jsx';

export default function MorningBriefingCard({
  t,
  todayPlan,
  setTodayPlan,
  notify,
  goToPlan,
  lang = 'hi',
}) {
  const [activeFocusTask, setActiveFocusTask] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showAddQuick, setShowAddQuick] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickSlot, setQuickSlot] = useState('morning');
  const [quickMin, setQuickMin] = useState(45);

  const priorities = todayPlan?.priorities || [];
  const completedCount = priorities.filter((p) => p.completed).length;
  const totalCount = priorities.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function toggleTaskComplete(id) {
    const updated = priorities.map((p) => {
      if (p.id === id) {
        const nextState = !p.completed;
        if (nextState) {
          soundEngine.playTaskCompleteSound(true);
        }
        return {
          ...p,
          completed: nextState,
          completedAt: nextState ? new Date().toISOString() : null,
        };
      }
      return p;
    });

    const newPlan = { ...todayPlan, priorities: updated };
    setTodayPlan(newPlan);
    savePrioritiesPlan(todayPlan.date, newPlan);

    // If all completed, trigger confetti!
    const nowDone = updated.filter((p) => p.completed).length;
    if (nowDone === updated.length && updated.length > 0) {
      fireConfetti();
      notify('🎉 Shabash! Aaj ke saare top priorities poore hue!');
    }
  }

  function handleMoveToTomorrow(id) {
    const taskToMove = priorities.find((p) => p.id === id);
    if (!taskToMove) return;

    // Remove from today
    const updatedToday = priorities.filter((p) => p.id !== id);
    const newTodayPlan = { ...todayPlan, priorities: updatedToday };
    setTodayPlan(newTodayPlan);
    savePrioritiesPlan(todayPlan.date, newTodayPlan);

    // Add to tomorrow's plan
    const tomorrowStr = addDays(todayPlan.date, 1);
    const tomorrowPlan = loadPrioritiesPlan(tomorrowStr);
    const updatedTomorrow = [
      ...tomorrowPlan.priorities,
      {
        ...taskToMove,
        id: `p-${tomorrowStr}-${Date.now().toString(36)}`,
        rank: tomorrowPlan.priorities.length + 1,
        completed: false,
        completedAt: null,
      },
    ];
    savePrioritiesPlan(tomorrowStr, { ...tomorrowPlan, priorities: updatedTomorrow });

    notify('Task kal ke plan mein shift ho gaya');
  }

  function handleAddQuickPriority(e) {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    const newTask = {
      id: `p-${todayPlan.date}-${Date.now().toString(36)}`,
      rank: priorities.length + 1,
      title: quickTitle.trim(),
      slot: quickSlot,
      category: 'Deep work',
      area: 'personal',
      estMin: Number(quickMin) || 45,
      energy: 4,
      completed: false,
      completedAt: null,
    };

    const updated = [...priorities, newTask];
    const newPlan = { ...todayPlan, priorities: updated };
    setTodayPlan(newPlan);
    savePrioritiesPlan(todayPlan.date, newPlan);

    setQuickTitle('');
    setShowAddQuick(false);
    notify('Naya priority task joda gaya');
  }

  function toggleHabit(habitKey) {
    const habits = todayPlan.habits || {};
    const nextState = !habits[habitKey];
    if (nextState) soundEngine.playTaskCompleteSound(true);

    const newPlan = {
      ...todayPlan,
      habits: { ...habits, [habitKey]: nextState },
    };
    setTodayPlan(newPlan);
    savePrioritiesPlan(todayPlan.date, newPlan);
  }

  function handleListenBriefing() {
    if (isSpeaking) {
      soundEngine.stopSpeech();
      setIsSpeaking(false);
      return;
    }

    // Play morning sunrise chime first
    soundEngine.playMorningChime(true);

    let speechText = '';
    if (lang === 'hi') {
      speechText = `Shubh Prabhat! Aaj ki aapki top priorities hain: ${
        priorities.length === 0
          ? 'Abhi tak koi priority tay nahi hai.'
          : priorities
              .map((p, idx) => `Number ${idx + 1}: ${p.title}, lagbhag ${p.estMin} minute.`)
              .join(' ')
      } Focus ke saath din shuru karein aur din jeetein!`;
    } else {
      speechText = `Good morning! Here is your daily priority briefing: ${
        priorities.length === 0
          ? 'No priorities planned yet.'
          : priorities
              .map((p, idx) => `Priority ${idx + 1}: ${p.title}, estimated ${p.estMin} minutes.`)
              .join(' ')
      } Execute with clarity!`;
    }

    setIsSpeaking(true);
    soundEngine.speakText(speechText, lang === 'hi' ? 'hi' : 'en');

    setTimeout(() => {
      setIsSpeaking(false);
    }, Math.max(4000, speechText.length * 75));
  }

  return (
    <div className="card" style={{
      border: '1.5px solid var(--accent)',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top Banner Header */}
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--accent)',
          }}>
            ☀️ {t('morning_briefing_title')}
          </span>
          <h3 style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 800 }}>
            {t('morning_briefing_sub')}
          </h3>
        </div>
        <button
          type="button"
          className="chip on"
          onClick={handleListenBriefing}
          style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
          title="Audio Briefing"
        >
          {isSpeaking ? `⏹️ ${t('morning_listen_stop')}` : `🔊 ${t('morning_listen_btn')}`}
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="row between" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
            <span className="muted">
              <strong>{completedCount} / {totalCount}</strong> priorities completed
            </span>
            <span style={{ fontWeight: 700, color: progressPct === 100 ? 'var(--ok)' : 'var(--accent)' }}>
              {progressPct}%
            </span>
          </div>
          <div style={{
            height: 7,
            background: 'var(--line)',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: progressPct === 100 ? 'var(--ok)' : 'var(--grad-main)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Priorities List */}
      {priorities.length === 0 ? (
        <div style={{
          padding: '20px 12px',
          textAlign: 'center',
          background: 'var(--surface-2)',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600 }}>
            Kal raat koi priorities seal nahi hui thi.
          </p>
          <p className="muted" style={{ fontSize: '0.88rem', margin: '0 0 14px' }}>
            Din shuru karne se pehle aaj ke top 3 kaam chuniye:
          </p>
          <button type="button" className="primary sm" onClick={() => setShowAddQuick(true)}>
            + Aaj Ke Priorities Set Karein
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {priorities.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 12,
                background: item.completed ? 'var(--ok-soft)' : 'var(--surface-2)',
                border: item.completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--line)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={Boolean(item.completed)}
                onChange={() => toggleTaskComplete(item.id)}
                style={{
                  width: 20,
                  height: 20,
                  accentColor: 'var(--ok)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                aria-label={`Mark ${item.title} done`}
              />

              {/* Priority Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 6,
                    background: item.rank === 1 ? 'var(--grad-fire)' : 'var(--line)',
                    color: item.rank === 1 ? '#fff' : 'var(--text)',
                  }}>
                    #{item.rank || idx + 1}
                  </span>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '0.98rem',
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? 'var(--muted)' : 'var(--text)',
                    wordBreak: 'break-word',
                  }}>
                    {item.title}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                  <span>{item.slot ? `${item.slot} focus` : ''}</span>
                  {item.estMin ? ` · ~${item.estMin} min` : ''}
                  {item.category ? ` · ${item.category}` : ''}
                </div>
              </div>

              {/* Actions */}
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {!item.completed && (
                  <button
                    type="button"
                    className="ghost sm"
                    onClick={() => setActiveFocusTask(item)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '4px 8px',
                      color: 'var(--accent)',
                      borderColor: 'var(--accent)',
                    }}
                    title="Start Focus Timer"
                  >
                    ⏱️ Focus
                  </button>
                )}
                {!item.completed && (
                  <button
                    type="button"
                    className="ghost sm"
                    onClick={() => handleMoveToTomorrow(item.id)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '4px 6px',
                      opacity: 0.75,
                    }}
                    title="Move to tomorrow"
                  >
                    Kal shift
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Add Form */}
      {showAddQuick ? (
        <form onSubmit={handleAddQuickPriority} style={{
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>+ Aaj Ka Naya Priority Kaam</h4>
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Kaam ka naam..."
            required
            autoFocus
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
            <select
              value={quickSlot}
              onChange={(e) => setQuickSlot(e.target.value)}
              style={{ flex: 1, minWidth: 120 }}
            >
              <option value="morning">Subah (Morning Focus)</option>
              <option value="afternoon">Dopahar (Afternoon)</option>
              <option value="evening">Shaam (Evening)</option>
            </select>
            <input
              type="number"
              value={quickMin}
              onChange={(e) => setQuickMin(e.target.value)}
              placeholder="Min"
              min="5"
              max="360"
              style={{ width: 80 }}
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="primary sm">Jodein</button>
            <button type="button" className="ghost sm" onClick={() => setShowAddQuick(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <button
            type="button"
            className="ghost sm"
            onClick={() => setShowAddQuick(true)}
            style={{ fontSize: '0.82rem' }}
          >
            {t('priority_quick_add')}
          </button>
          <button
            type="button"
            className="ghost sm"
            onClick={goToPlan}
            style={{ fontSize: '0.82rem', color: 'var(--accent)' }}
          >
            🌙 Kal Ki Planning (Night Routine) →
          </button>
        </div>
      )}

      {/* Morning Kickstart Habits */}
      <div style={{
        borderTop: '1px solid var(--line)',
        paddingTop: 12,
        marginTop: 6,
      }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
          ⚡ {t('kickstart_habits')}
        </span>
        <div className="row wrap" style={{ gap: 12, marginTop: 8 }}>
          <label className="check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(todayPlan?.habits?.water)}
              onChange={() => toggleHabit('water')}
            />
            {t('habit_water')}
          </label>
          <label className="check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(todayPlan?.habits?.sunlight)}
              onChange={() => toggleHabit('sunlight')}
            />
            {t('habit_sun')}
          </label>
          <label className="check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(todayPlan?.habits?.noPhone)}
              onChange={() => toggleHabit('noPhone')}
            />
            {t('habit_nophone')}
          </label>
        </div>
      </div>

      {/* Focus Timer Modal */}
      {activeFocusTask && (
        <FocusTimerModal
          priority={activeFocusTask}
          onClose={() => setActiveFocusTask(null)}
          onComplete={(id) => {
            toggleTaskComplete(id);
            setActiveFocusTask(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}
