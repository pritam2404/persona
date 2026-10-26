// Browser ke andar AI awaaz (Piper TTS, open-source). Koi server / Python nahi.
// Pehli baar voice model (~60 MB) internet se aata hai, phir phone/PC mein save rehta hai
// (OPFS = browser ki private storage). Uske baad turant.
//
// Ye file badi library (onnxruntime) laati hai, isliye app ise sirf "Video banao" dabane
// pe load karta hai (dynamic import) - baaki app halka rehta hai.

import * as piper from '@mintplex-labs/piper-tts-web';
import { VOICES } from './voices.js';

// Library ki built-in list mein Hindi nahi -> hamare Rhasspy paths jodo
for (const list of Object.values(VOICES)) {
  for (const v of list) if (v.path) piper.PATH_MAP[v.id] = v.path;
}

let session = null;
let sessionVoice = null;

/**
 * Voice load karo (pehli baar download). onProgress(0..1) download ke liye.
 * Note: library ek hi "singleton" session rakhti hai jo voice badalne pe model reload NAHI karti,
 * isliye voice badle to purana session khud hata dete hain.
 */
export async function loadVoice(voiceId, onProgress) {
  if (session && sessionVoice === voiceId) return session;
  piper.TtsSession._instance = null;
  session = null;
  const s = await piper.TtsSession.create({
    voiceId,
    progress: (p) => {
      if (p?.url?.endsWith('.onnx') && p.total) onProgress?.(p.loaded / p.total);
    },
  });
  session = s;
  sessionVoice = voiceId;
  onProgress?.(1);
  return s;
}

/** Kya ye voice pehle se phone/PC mein save hai? (download dobara nahi hoga) */
export async function isVoiceStored(voiceId) {
  try {
    return (await piper.stored()).includes(voiceId);
  } catch {
    return false;
  }
}

/** text -> AudioBuffer */
export async function synth(text, ctx) {
  if (!session) throw new Error('Voice load nahi hui');
  const wav = await session.predict(text);
  return ctx.decodeAudioData(await wav.arrayBuffer());
}
