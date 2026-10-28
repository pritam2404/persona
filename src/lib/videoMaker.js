// Browser ke andar poora coach video: AI awaaz + photo (halka zoom) + captions -> MP4/WebM.
// Koi server, Python ya terminal nahi.
//
// Kaise: har line ki awaaz (tts.js) -> ek lambi audio -> canvas pe har frame draw ->
// MediaRecorder canvas + audio dono ko record karta hai. Recording "real time" hoti hai:
// 50 sec ka video = ~50 sec lagenge. Us dauran screen on rakhni hai (tab chhupne pe browser
// drawing rok deta hai).

import { forSpeech } from './speech.js';

const W = 720;
const H = 1280;
const FPS = 30;
const GAP = 0.5; // lines ke beech saans jaisa gap (sec)

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

export function canMakeVideo() {
  return Boolean(
    pickMime() &&
      typeof AudioContext !== 'undefined' &&
      HTMLCanvasElement.prototype.captureStream &&
      navigator.storage?.getDirectory // voice model cache (OPFS)
  );
}

/** Awaaz ke aage-peeche ki khamoshi kaato, taaki gap ek jaisa rahe */
function trimSilence(buf, ctx, threshold = 0.01) {
  const d = buf.getChannelData(0);
  let a = 0;
  let b = d.length - 1;
  while (a < b && Math.abs(d[a]) < threshold) a += 1;
  while (b > a && Math.abs(d[b]) < threshold) b -= 1;
  const pad = Math.floor(0.05 * buf.sampleRate);
  a = Math.max(0, a - pad);
  b = Math.min(d.length - 1, b + pad);
  const out = ctx.createBuffer(1, b - a + 1, buf.sampleRate);
  out.copyToChannel(d.subarray(a, b + 1), 0);
  return out;
}

/** Saari lines ki awaaz jodo; har line kab shuru/khatam hoti hai uska hisaab rakho */
function joinAudio(parts, ctx) {
  const sr = ctx.sampleRate;
  const gap = Math.floor(GAP * sr);
  const total = gap + parts.reduce((n, p) => n + p.buf.length + gap, 0);
  const out = ctx.createBuffer(1, total, sr);
  const ch = out.getChannelData(0);
  const segments = [];
  let pos = gap;
  for (const p of parts) {
    ch.set(p.buf.getChannelData(0), pos);
    segments.push({ text: p.text, start: pos / sr, end: (pos + p.buf.length) / sr });
    pos += p.buf.length + gap;
  }
  return { buffer: out, segments, duration: total / sr };
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
}

const FONT = '"Noto Sans Devanagari", "Nirmala UI", "Segoe UI", system-ui, sans-serif';

function drawFrame(g, t, { photo, title, segments, duration }) {
  // Background: photo "cover" crop + dheere zoom (Ken Burns), warna gradient
  if (photo) {
    const z = 1 + 0.08 * Math.min(1, t / Math.max(duration, 1));
    const s = Math.max(W / photo.width, H / photo.height) * z;
    const dw = photo.width * s;
    const dh = photo.height * s;
    g.drawImage(photo, (W - dw) / 2, (H - dh) * 0.35, dw, dh);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#1e1b4b');
    gr.addColorStop(1, '#4f46e5');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  // Neeche dark shade - caption kisi bhi photo pe padha jaye
  const sh = g.createLinearGradient(0, H * 0.5, 0, H);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = sh;
  g.fillRect(0, H * 0.5, W, H * 0.5);

  // Upar title patti
  g.fillStyle = 'rgba(0,0,0,0.42)';
  g.fillRect(0, 0, W, 104);
  g.fillStyle = '#c7d2fe';
  g.font = `700 34px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(title, 36, 54, W - 72);

  // Abhi kaunsi line chal rahi hai (gap mein pichhli line dikhti rahe)
  let seg = null;
  for (const s of segments) if (t >= s.start - GAP / 2) seg = s;
  if (seg) {
    const fadeIn = Math.min(1, Math.max(0, (t - (seg.start - GAP / 2)) / 0.25));
    g.globalAlpha = fadeIn;
    g.font = `700 46px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const lines = wrap(g, seg.text, W - 96);
    const lh = 64;
    let y = H - 130 - (lines.length - 1) * lh;
    for (const ln of lines) {
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.fillText(ln, W / 2 + 2, y + 3);
      g.fillStyle = '#ffffff';
      g.fillText(ln, W / 2, y);
      y += lh;
    }
    g.globalAlpha = 1;
  }

  // Neeche patli progress bar
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, H - 8, W, 8);
  g.fillStyle = '#818cf8';
  g.fillRect(0, H - 8, W * Math.min(1, t / duration), 8);
}

/**
 * @param {{title:string, beats:string[], lang:'hi'|'en', voiceId:string, photo?:File|null,
 *          onStatus?:(s:{stage:string, p:number, text:string})=>void, signal?:AbortSignal,
 *          preview?:HTMLCanvasElement}} o
 * @returns {Promise<{blob:Blob, mime:string, ext:string, duration:number}>}
 */
export async function makeVideo(o) {
  // AudioContext click ke andar hi (kisi bhi await se pehle) banana chahiye, warna browser
  // use "suspended" rakh sakta hai. Isliye caller (button click) ise bana ke deta hai.
  const actx = o.audioContext || new AudioContext();
  const status = (stage, p, text) => o.onStatus?.({ stage, p, text });
  const check = () => {
    if (o.signal?.aborted) throw new DOMException('Cancel hua', 'AbortError');
  };

  try {
    const mime = pickMime();
    if (!mime) throw new Error('Ye browser video record nahi kar sakta. Chrome use karo.');

    status('voice', 0, 'Awaaz ka engine load ho raha hai…');
    // Bhaari library (onnxruntime) sirf yahan load hoti hai
    const { loadVoice, synth } = await import('./tts.js');
    status('voice', 0, 'Awaaz ka model load ho raha hai (pehli baar ~60 MB)…');
    await loadVoice(o.voiceId, (p) => status('voice', p, `Awaaz download: ${Math.round(p * 100)}%`));
    check();

    const parts = [];
    for (let i = 0; i < o.beats.length; i += 1) {
      status('tts', i / o.beats.length, `Awaaz ban rahi hai: line ${i + 1}/${o.beats.length}`);
      // Captions = beats (story ki bhasha). Awaaz = spoken line (agar alag di ho, jaise English).
      const say = o.spoken?.[i] ?? o.beats[i];
      const buf = await synth(forSpeech(say, o.speechLang || o.lang), actx);
      parts.push({ text: o.beats[i], buf: trimSilence(buf, actx) });
      check();
    }
    const audio = joinAudio(parts, actx);

    let photo = null;
    if (o.photo) {
      photo = await createImageBitmap(o.photo, { imageOrientation: 'from-image' });
    }
    const scene = { photo, title: o.title, segments: audio.segments, duration: audio.duration };

    const canvas = o.preview || document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    drawFrame(g, 0, scene);

    // Recording: canvas video + audio (speaker pe nahi bajta, seedha recording mein)
    const dest = actx.createMediaStreamDestination();
    const src = actx.createBufferSource();
    src.buffer = audio.buffer;
    src.connect(dest);
    const stream = new MediaStream([
      ...canvas.captureStream(FPS).getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((res, rej) => {
      rec.onstop = res;
      rec.onerror = (e) => rej(e.error || new Error('Recording fail hui'));
    });

    await actx.resume();
    rec.start(1000);
    const t0 = actx.currentTime;
    src.start();

    await new Promise((resolve, reject) => {
      const tick = () => {
        if (o.signal?.aborted) {
          reject(new DOMException('Cancel hua', 'AbortError'));
          return;
        }
        const t = actx.currentTime - t0; // audio ki ghadi = lip/caption sync pakka
        drawFrame(g, t, scene);
        status('record', Math.min(1, t / audio.duration),
          `Video record ho raha hai: ${Math.floor(t)}/${Math.ceil(audio.duration)} sec. Screen on rakho.`);
        if (t >= audio.duration + 0.3) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }).finally(() => {
      try { src.stop(); } catch { /* pehle hi ruk gaya */ }
      if (rec.state !== 'inactive') rec.stop();
    });
    await done;
    stream.getTracks().forEach((tr) => tr.stop());
    photo?.close?.();

    const type = mime.split(';')[0];
    status('done', 1, 'Video ready');
    return {
      blob: new Blob(chunks, { type }),
      mime: type,
      ext: type === 'video/mp4' ? 'mp4' : 'webm',
      duration: audio.duration,
    };
  } finally {
    actx.close().catch(() => {});
  }
}
