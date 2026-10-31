import { useState, useEffect, useRef } from 'react';
import { soundEngine } from '../utils/audio.ts';

/**
 * Smart Broken-Speech Parser:
 * Takes casual, broken, rambling voice notes in Bengali, Hindi, or English,
 * and extracts structured, clean priority tasks.
 */
function parseSpokenPriorities(rawText, lang = 'hi') {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText.trim();
  // Split multiple clauses by connectors: "ar", "aur", "and", "tarpor", "phir", "then", commas
  const clauses = text
    .split(/\s+(?:ar|aar|aur|and|then|tarpor|phir|ebong|\+|\&)\s+|,|\./i)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);

  const results = [];

  clauses.forEach((clause) => {
    const lower = clause.toLowerCase();

    // 1. Detect Time Slot
    let slot = 'morning';
    if (/dupur|dopahar|noon|afternoon|1[2-5]:\d\d|[1-3]\s*pm/i.test(lower)) {
      slot = 'afternoon';
    } else if (/bikel|bikeler|shaam|sondha|evening|raat|night|[4-9]\s*pm/i.test(lower)) {
      slot = 'evening';
    } else if (/shokal|subah|morning|bhor|[6-9]\s*am|1[0-1]\s*am/i.test(lower)) {
      slot = 'morning';
    }

    // 2. Detect Category
    let category = 'Deep work';
    let energy = 5;
    let estMin = 45;

    if (/gym|workout|walk|jog|exercise|dourano|byayam|yoga|health/i.test(lower)) {
      category = 'Health';
      energy = 4;
      estMin = 30;
    } else if (/meeting|call|client|sync|charcha|kotha/i.test(lower)) {
      category = 'Meetings';
      energy = 3;
      estMin = 30;
    } else if (/porashona|study|padhai|read|book|course/i.test(lower)) {
      category = 'Study';
      energy = 4;
      estMin = 60;
    } else if (/mail|email|chat|admin|bill|pay|bank|chores|bazar|market/i.test(lower)) {
      category = 'Admin';
      energy = 2;
      estMin = 20;
    } else {
      category = 'Deep work';
      energy = 5;
      estMin = 60;
    }

    // 3. Clean up title: Remove conversational filler words
    let cleanTitle = clause
      .replace(/^(are|yaar|dekho|shono|amake|aamake|aaj|kal|kaal|subah|shokal|dupur|bikel|shaam|raat)\s+/gi, '')
      .replace(/\s+(korte hobe|karna hai|jaana hai|jabo|finish korbo|khatam karna|hobe|korbo|karna)\b/gi, '')
      .replace(/^(kal|kaal|tomorrow|today|aaj)\s+/gi, '')
      .trim();

    // Capitalize first letter
    if (cleanTitle) {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    } else {
      cleanTitle = clause;
    }

    results.push({
      title: cleanTitle,
      slot,
      category,
      area: category === 'Health' ? 'personal' : 'office',
      estMin,
      energy,
      completed: false,
      completedAt: null,
      rawSpeech: clause,
    });
  });

  return results.length > 0 ? results : [{
    title: text,
    slot: 'morning',
    category: 'Deep work',
    area: 'personal',
    estMin: 45,
    energy: 4,
    completed: false,
    completedAt: null,
    rawSpeech: text,
  }];
}

export default function VoicePriorityRecorder({ isOpen, onClose, onAddPriorities, lang = 'hi', t }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [supported, setSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  function startRecording() {
    setErrorMsg('');
    setTranscript('');
    setParsedItems([]);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Aapke browser mein Web Speech support nahi hai. Chrome ya Edge use karein.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      // Select speech recognition language matching Persona language
      if (lang === 'bn') {
        recognition.lang = 'bn-IN';
      } else if (lang === 'hi') {
        recognition.lang = 'hi-IN';
      } else {
        recognition.lang = 'en-IN';
      }

      recognition.onstart = () => {
        setIsListening(true);
        soundEngine.playTaskCompleteSound(true);
      };

      recognition.onresult = (event) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentText.trim());
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          setErrorMsg('Microphone permission allow karein.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setErrorMsg('Microphone shuru nahi ho paya.');
      setIsListening(false);
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);

    // Parse transcript into clean priorities
    if (transcript.trim()) {
      const items = parseSpokenPriorities(transcript, lang);
      setParsedItems(items);
    }
  }

  function handleAddAll() {
    if (parsedItems.length === 0) return;
    onAddPriorities(parsedItems);
    soundEngine.playTaskCompleteSound(true);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(11, 16, 32, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 16,
    }}>
      <div className="card" style={{
        maxWidth: 480,
        width: '100%',
        padding: '24px 20px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div className="row between" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)' }}>
            🎙️ {t('voice_record_btn') || 'Voice Note Priority'}
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
          {t('voice_hint') || 'Speak brokenly or casually — Persona will clean and structure your priorities.'}
        </p>

        {/* Big Animated Microphone */}
        <div style={{ margin: '20px 0' }}>
          <button
            type="button"
            onClick={isListening ? stopRecording : startRecording}
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              border: 'none',
              background: isListening ? 'var(--grad-fire)' : 'var(--grad-main)',
              color: '#fff',
              fontSize: '2.2rem',
              cursor: 'pointer',
              boxShadow: isListening
                ? '0 0 0 12px rgba(239, 68, 68, 0.25), 0 0 0 24px rgba(239, 68, 68, 0.1)'
                : '0 8px 24px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.3s ease',
            }}
          >
            {isListening ? '⏹️' : '🎙️'}
          </button>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: '0.95rem' }}>
            {isListening
              ? (t('voice_recording') || 'Listening... Speak now...')
              : (transcript ? 'Tap mic to record again' : 'Tap mic and speak')}
          </div>
        </div>

        {/* Real-time Transcript */}
        {transcript && (
          <div style={{
            padding: '12px 14px',
            background: 'var(--surface-2)',
            borderRadius: 12,
            border: '1px solid var(--line)',
            fontSize: '0.92rem',
            textAlign: 'left',
            marginBottom: 16,
            maxHeight: 120,
            overflowY: 'auto',
          }}>
            <span className="muted" style={{ fontSize: '0.75rem', display: 'block', marginBottom: 2 }}>
              Aapne bola (Transcript):
            </span>
            "{transcript}"
          </div>
        )}

        {/* Parsed Clean Priorities */}
        {parsedItems.length > 0 && (
          <div style={{ textAlign: 'left', marginBottom: 18 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase' }}>
              ✓ Persona ne yeh priorities extract kiye:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {parsedItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--ok-soft)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '0.88rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: 'var(--accent)',
                      color: '#fff',
                    }}>
                      #{idx + 1}
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                    Slot: {item.slot} · ~{item.estMin} min · {item.category}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <p style={{ color: 'var(--bad)', fontSize: '0.85rem', marginBottom: 14 }}>
            {errorMsg}
          </p>
        )}

        {/* Manual text input fallback if user cannot use microphone */}
        {!isListening && parsedItems.length === 0 && (
          <div style={{ margin: '10px 0 16px', textAlign: 'left' }}>
            <span className="muted" style={{ fontSize: '0.78rem' }}>Ya yahan brokenly type karein:</span>
            <div className="row" style={{ marginTop: 4 }}>
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: কাল সকালে প্রেজেন্টেশন ও বিকেলে জিম...' : 'Jaise: kal subah presentation aur shaam ko gym...'}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="ghost sm"
                onClick={() => {
                  if (transcript.trim()) {
                    setParsedItems(parseSpokenPriorities(transcript, lang));
                  }
                }}
              >
                Parse
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
          {parsedItems.length > 0 ? (
            <button
              type="button"
              className="primary"
              onClick={handleAddAll}
              style={{ padding: '8px 20px' }}
            >
              ✓ {parsedItems.length} Priorities Add Karein
            </button>
          ) : isListening ? (
            <button
              type="button"
              className="primary"
              onClick={stopRecording}
              style={{ background: 'var(--bad)' }}
            >
              Done Bolna Khatam
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
