import { useState, useEffect, useRef } from 'react';
import { soundEngine } from '../utils/audio.ts';
import { fireConfetti } from '../utils/confetti.ts';

export default function FocusTimerModal({ priority, onClose, onComplete, t }) {
  const [secondsLeft, setSecondsLeft] = useState((priority.estMin || 25) * 60);
  const [totalSeconds, setTotalSeconds] = useState((priority.estMin || 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [ambientSound, setAmbientSound] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            soundEngine.playTimerDoneSound(true);
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  useEffect(() => {
    soundEngine.toggleFocusNoise(ambientSound);
    return () => {
      soundEngine.toggleFocusNoise(false);
    };
  }, [ambientSound]);

  function setPreset(mins) {
    setIsRunning(false);
    setTotalSeconds(mins * 60);
    setSecondsLeft(mins * 60);
  }

  function handleComplete() {
    soundEngine.toggleFocusNoise(false);
    soundEngine.playTaskCompleteSound(true);
    fireConfetti();
    onComplete(priority.id);
    onClose();
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progressPct = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(11, 16, 32, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <div className="card" style={{
        maxWidth: 460,
        width: '100%',
        padding: '24px 20px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <span className="chip on" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
            🎯 Focus Mode
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 style={{ margin: '8px 0 4px', fontSize: '1.25rem' }}>{priority.title}</h3>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
          {priority.slot ? `Slot: ${priority.slot} · ` : ''}
          {priority.category || 'Deep work'}
        </p>

        {/* Big Digital Timer */}
        <div style={{
          fontSize: '3.75rem',
          fontWeight: 800,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '-1px',
          margin: '16px 0',
          color: isRunning ? 'var(--accent)' : 'inherit',
        }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6,
          background: 'var(--line)',
          borderRadius: 99,
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'var(--grad-main)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Presets */}
        <div className="row" style={{ justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          <button type="button" className={`chip ${totalSeconds === 1500 ? 'on' : ''}`} onClick={() => setPreset(25)}>
            25m
          </button>
          <button type="button" className={`chip ${totalSeconds === 3000 ? 'on' : ''}`} onClick={() => setPreset(50)}>
            50m
          </button>
          <button type="button" className={`chip ${totalSeconds === 900 ? 'on' : ''}`} onClick={() => setPreset(15)}>
            15m
          </button>
          <button type="button" className={`chip ${ambientSound ? 'on' : ''}`} onClick={() => setAmbientSound(!ambientSound)}>
            🌧️ {ambientSound ? 'Rain Sound On' : 'Rain Sound Off'}
          </button>
        </div>

        {/* Controls */}
        <div className="row wrap" style={{ justifyContent: 'center', gap: 10 }}>
          <button
            type="button"
            className="primary"
            style={{ minWidth: 120, fontSize: '1rem', padding: '10px 20px' }}
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? '⏸️ Ruko (Pause)' : '▶️ Focus Shuru'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setIsRunning(false);
              setSecondsLeft(totalSeconds);
            }}
          >
            🔄 Reset
          </button>
          <button
            type="button"
            className="ghost"
            style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }}
            onClick={handleComplete}
          >
            ✓ Done Mark Karein
          </button>
        </div>
      </div>
    </div>
  );
}
