import { useEffect, useRef, useState } from 'react';
import { askGemini, buildContext, looksLikeKey, KEY_STORE } from '../lib/chat.js';

const HISTORY_STORE = 'persona.chat.v1';

function loadHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_STORE) || '[]');
  } catch {
    return [];
  }
}

/**
 * Floating 💬 button + chat panel. Gemini key user ki apni (phone mein save).
 * Chat history sirf is session tak (app band = history saaf).
 */
export default function ChatPanel({ t, tasks, settings }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORE) || '');
  const [keyDraft, setKeyDraft] = useState('');
  const [msgs, setMsgs] = useState(loadHistory);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { sessionStorage.setItem(HISTORY_STORE, JSON.stringify(msgs.slice(-20))); }, [msgs]);
  useEffect(() => { listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [msgs, busy, open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, apiKey]);

  function saveKey(e) {
    e.preventDefault();
    const k = keyDraft.trim();
    if (!looksLikeKey(k)) { setErr('Key sahi nahi lag rahi. Google AI Studio se poori copy karo.'); return; }
    localStorage.setItem(KEY_STORE, k);
    setApiKey(k);
    setKeyDraft('');
    setErr('');
  }

  function removeKey() {
    localStorage.removeItem(KEY_STORE);
    localStorage.removeItem('persona.gemini.model');
    setApiKey('');
  }

  async function send(text) {
    const question = String(text ?? q).trim().slice(0, 500);
    if (!question || busy) return;
    setQ('');
    setErr('');
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const answer = await askGemini({
        apiKey, history, question, lang: settings.lang,
        context: buildContext(tasks, settings),
      });
      setMsgs((m) => [...m, { role: 'model', text: answer }]);
    } catch (e2) {
      setErr(`${t('chat_err')}: ${e2.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={open ? 'chat-fab open' : 'chat-fab'}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('chat_title')}
        aria-expanded={open}
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label={t('chat_title')}>
          <div className="chat-head">
            <strong>🤖 {t('chat_title')}</strong>
            <div className="row">
              {apiKey && msgs.length > 0 && (
                <button type="button" className="chat-mini" onClick={() => setMsgs([])}>{t('chat_clear')}</button>
              )}
              <button type="button" className="chat-mini" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </div>

          {!apiKey ? (
            <form className="chat-body chat-setup" onSubmit={saveKey}>
              <p>{t('chat_need_key')}</p>
              <ol className="how">
                <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> kholo (Google account se login)</li>
                <li>"Create API key" dabao, key copy karo</li>
                <li>Neeche paste karke Save</li>
              </ol>
              <input
                ref={inputRef}
                type="password"
                autoComplete="off"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder={t('chat_key_ph')}
                aria-label={t('chat_key_ph')}
              />
              <button type="submit" className="primary">{t('chat_key_save')}</button>
              {err && <p className="errors" role="alert">{err}</p>}
              <p className="hint">🔒 {t('chat_privacy')}</p>
            </form>
          ) : (
            <>
              <div className="chat-body" ref={listRef} aria-live="polite">
                {msgs.length === 0 && (
                  <>
                    <div className="bubble model">{t('chat_hello')}</div>
                    <div className="chat-sugs">
                      {['chat_s1', 'chat_s2', 'chat_s3'].map((k) => (
                        <button key={k} type="button" className="chip" onClick={() => send(t(k))}>{t(k)}</button>
                      ))}
                    </div>
                  </>
                )}
                {msgs.map((m, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
                ))}
                {busy && <div className="bubble model typing" aria-label={t('chat_thinking')}><span /><span /><span /></div>}
                {err && <p className="errors" role="alert">{err}</p>}
              </div>
              <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input
                  ref={inputRef}
                  value={q}
                  maxLength={500}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('chat_ph')}
                  aria-label={t('chat_ph')}
                  disabled={busy}
                />
                <button type="submit" className="primary" disabled={busy || !q.trim()} aria-label={t('chat_send')}>➤</button>
              </form>
              <div className="chat-foot">
                <span className="hint">🔒 {t('chat_privacy')}</span>
                <button type="button" className="chat-mini" onClick={removeKey}>{t('chat_remove_key')}</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
