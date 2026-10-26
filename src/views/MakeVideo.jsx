import { useEffect, useRef, useState } from 'react';
import { VOICES } from '../lib/voices.js';
import { canMakeVideo, makeVideo } from '../lib/videoMaker.js';
import { addVideo } from '../lib/videoStore.js';

/**
 * Ek click: script -> AI awaaz + photo + captions -> video file (phone/PC dono pe).
 * Photo sirf is device pe rehti hai, kahin upload nahi hoti.
 */
export default function MakeVideo({ title, beats, lang, day, notify }) {
  const voices = VOICES[lang] || VOICES.hi;
  const [voiceId, setVoiceId] = useState(voices[0].id);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const canvasRef = useRef(null);
  const supported = canMakeVideo();

  // Bhasha badli -> us bhasha ki pehli awaaz
  useEffect(() => {
    if (!voices.some((v) => v.id === voiceId)) setVoiceId(voices[0].id);
  }, [voices, voiceId]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [photoUrl, result]);

  function pickPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { notify('Photo (jpg/png) chuno'); return; }
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  }

  async function start() {
    if (!beats.length) { notify('Script khaali hai'); return; }
    // Click ke andar hi AudioContext (browser ka rule)
    const audioContext = new AudioContext();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setResult(null);
    try {
      const out = await makeVideo({
        title, beats, lang, voiceId, photo, audioContext,
        signal: ac.signal,
        preview: canvasRef.current,
        onStatus: setStatus,
      });
      const name = `persona-coach-${day}.${out.ext}`;
      const file = new File([out.blob], name, { type: out.mime });
      await addVideo(file).catch(() => notify('Videos tab mein save nahi hua (jagah kam?)'));
      setResult({ url: URL.createObjectURL(out.blob), name, blob: out.blob, ext: out.ext });
      notify('Video ready - Videos tab mein bhi save hua');
    } catch (err) {
      if (err?.name === 'AbortError') notify('Video banana cancel hua');
      else {
        console.error(err);
        notify(`Video nahi bana: ${err?.message || err}`);
        setStatus({ stage: 'error', p: 0, text: `Error: ${err?.message || err}. Internet check karke dobara try karo.` });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function download() {
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    const file = new File([result.blob], result.name, { type: result.blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: result.name }); } catch { /* cancel */ }
    } else {
      download();
    }
  }

  if (!supported) {
    return (
      <div className="card note-card">
        Is browser mein video nahi ban sakta. Phone pe <b>Chrome</b> ya PC pe <b>Chrome / Edge</b> mein kholo.
      </div>
    );
  }

  return (
    <div className="card make-video" aria-labelledby="mk-h">
      <h3 id="mk-h">🎬 Ek click mein video</h3>
      <p className="hint">Awaaz, photo aur captions ke saath video isi phone/PC pe banta hai. Python ya terminal ki zaroorat nahi.</p>

      <div className="form">
        <label>
          Awaaz
          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} disabled={busy}>
            {voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <div className="photo-pick">
          <span className="hint">Photo (optional)</span>
          <label className={busy ? 'ghost btn-like disabled' : 'ghost btn-like'}>
            {photo ? 'Photo badlo' : '+ Photo chuno'}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={pickPhoto} />
          </label>
          {photoUrl && <img src={photoUrl} alt="Chuni hui photo" className="thumb" />}
        </div>
      </div>

      <div className="row wrap">
        <button type="button" className="primary" onClick={start} disabled={busy}>
          {busy ? 'Video ban raha hai…' : 'Video banao'}
        </button>
        {busy && (
          <button type="button" className="ghost" onClick={() => abortRef.current?.abort()}>Cancel</button>
        )}
      </div>

      {status && status.stage !== 'done' && (
        <div className="progress-box" role="status" aria-live="polite">
          <p>{status.text}</p>
          {status.stage !== 'error' && (
            <progress max="1" value={status.p} aria-label="Progress" />
          )}
        </div>
      )}

      <canvas ref={canvasRef} className={busy ? 'preview' : 'preview hidden'} aria-hidden="true" />

      {result && (
        <div className="result">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={result.url} controls playsInline className="player" aria-label="Bana hua coach video" />
          <div className="row wrap">
            <button type="button" className="primary" onClick={download}>⬇ Download</button>
            <button type="button" className="ghost" onClick={share}>Share (WhatsApp / Drive)</button>
          </div>
          {result.ext === 'webm' && (
            <p className="hint">Ye browser .webm deta hai. WhatsApp pe na chale to Chrome ka naya version use karo (.mp4 deta hai).</p>
          )}
        </div>
      )}

      <details>
        <summary>Zaroori baatein</summary>
        <ul className="how">
          <li>Pehli baar awaaz ka model (~60 MB) download hota hai. WiFi pe karo. Uske baad phone mein save rehta hai.</li>
          <li>Recording real time hoti hai: 1 minute ka video = ~1 minute. Tab tak screen on rakho, app band mat karo.</li>
          <li>Photo kahin upload nahi hoti. Sirf apni photo ya AI-generated character use karo.</li>
          <li>Isme hoth nahi hilte (lip-sync). Uske liye Colab notebook hi hai, kyunki usko GPU chahiye.</li>
        </ul>
      </details>
    </div>
  );
}
