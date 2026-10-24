import { useEffect, useRef, useState } from 'react';
import { addVideo, listVideos, deleteVideo, storageInfo } from '../lib/videoStore.js';

const MAX_MB = 300;

function fmtMB(bytes) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

export default function VideosView({ notify }) {
  const [videos, setVideos] = useState([]);
  const [urls, setUrls] = useState({});
  const [playing, setPlaying] = useState(null);
  const [busy, setBusy] = useState(false);
  const [space, setSpace] = useState(null);
  const fileRef = useRef(null);

  async function refresh() {
    const list = await listVideos();
    setVideos(list);
    setUrls((old) => {
      Object.values(old).forEach((u) => URL.revokeObjectURL(u));
      return Object.fromEntries(list.map((v) => [v.id, URL.createObjectURL(v.blob)]));
    });
    setSpace(await storageInfo());
  }

  useEffect(() => {
    refresh().catch(() => notify('Videos load nahi hue'));
    return () => setUrls((old) => { Object.values(old).forEach((u) => URL.revokeObjectURL(u)); return {}; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPick(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    let added = 0;
    for (const f of files) {
      if (!f.type.startsWith('video/')) { notify(`${f.name}: video file nahi hai`); continue; }
      if (f.size > MAX_MB * 1e6) { notify(`${f.name}: ${MAX_MB} MB se bada hai`); continue; }
      try {
        await addVideo(f);
        added += 1;
      } catch {
        notify('Save nahi hua - phone mein jagah kam ho sakti hai');
      }
    }
    setBusy(false);
    if (added) notify(`${added} video save hua`);
    refresh();
  }

  async function saveToPhone(v) {
    const file = new File([v.blob], v.name, { type: v.type });
    // Android pe share sheet se "Save to Files / Drive / WhatsApp" milta hai
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: v.name });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // user ne cancel kiya
      }
    }
    const a = document.createElement('a');
    a.href = urls[v.id];
    a.download = v.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    notify('Download shuru hua - Downloads folder dekho');
  }

  async function remove(v) {
    if (!window.confirm(`"${v.name}" app se hata dein?`)) return;
    await deleteVideo(v.id);
    if (playing === v.id) setPlaying(null);
    notify('Video hataya');
    refresh();
  }

  return (
    <section aria-labelledby="vids-h">
      <h2 id="vids-h">Mere videos</h2>
      <p className="hint">
        Colab ya laptop se bana coach video phone mein download karo, phir yahan add karo.
        Videos sirf is phone ke andar rehte hain.
      </p>

      <button type="button" className="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Save ho raha hai…' : '+ Video add karo'}
      </button>
      <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={onPick} aria-label="Video chuno" />

      {space && (
        <p className="hint">Use: {space.usedMB.toFixed(0)} MB / jagah: {space.quotaMB.toFixed(0)} MB</p>
      )}

      {videos.length === 0 ? (
        <p className="muted">Abhi koi video nahi.</p>
      ) : (
        <ul className="list">
          {videos.map((v) => (
            <li key={v.id} className="item">
              <div className="item-main">
                <strong>{v.name}</strong>
                <span className="muted">{fmtMB(v.size)} · {new Date(v.addedAt).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="item-actions">
                <button type="button" className="ghost sm" onClick={() => setPlaying(playing === v.id ? null : v.id)}>
                  {playing === v.id ? 'Band karo' : 'Play'}
                </button>
                <button type="button" className="ghost sm" onClick={() => saveToPhone(v)}>Save / Share</button>
                <button type="button" className="ghost sm danger" onClick={() => remove(v)}>Delete</button>
              </div>
              {playing === v.id && urls[v.id] && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video className="player" src={urls[v.id]} controls autoPlay playsInline aria-label={v.name} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
