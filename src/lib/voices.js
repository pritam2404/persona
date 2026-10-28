// Video ki awaaz ke options (halki file - bhaari TTS library alag tts.js mein, jo sirf
// "Video banao" dabane pe load hoti hai).
// Models original Rhasspy Piper repo se (library ki apni list mein Indian bhashayein nahi hain).
// Library path ko "HF_BASE/<path>" banati hai; '../../../../' se huggingface.co ke root pe
// aa jaate hain, phir rhasspy ka path (browser URL khud normalise kar deta hai).
const R = '../../../../rhasspy/piper-voices/resolve/main';
const p = (lang, region, name) => `${R}/${lang}/${lang}_${region}/${name}/medium/${lang}_${region}-${name}-medium.onnx`;

export const VOICES = {
  hi: [
    { id: 'hi_IN-priyamvada-medium', label: 'Priyamvada', gender: 'female', path: p('hi', 'IN', 'priyamvada') },
    { id: 'hi_IN-pratham-medium', label: 'Pratham', gender: 'male', path: p('hi', 'IN', 'pratham') },
    { id: 'hi_IN-rohan-medium', label: 'Rohan', gender: 'male', path: p('hi', 'IN', 'rohan') },
  ],
  en: [
    { id: 'en_US-hfc_female-medium', label: 'HFC', gender: 'female' },
    { id: 'en_GB-alan-medium', label: 'Alan', gender: 'male' },
  ],
  bn: [
    { id: 'bn_BD-google-medium', label: 'Google (Bangla)', gender: 'female', path: p('bn', 'BD', 'google') },
  ],
  te: [
    { id: 'te_IN-padmavathi-medium', label: 'Padmavathi', gender: 'female', path: p('te', 'IN', 'padmavathi') },
    { id: 'te_IN-maya-medium', label: 'Maya', gender: 'female', path: p('te', 'IN', 'maya') },
    { id: 'te_IN-venkatesh-medium', label: 'Venkatesh', gender: 'male', path: p('te', 'IN', 'venkatesh') },
  ],
  ml: [
    { id: 'ml_IN-meera-medium', label: 'Meera', gender: 'female', path: p('ml', 'IN', 'meera') },
    { id: 'ml_IN-arjun-medium', label: 'Arjun', gender: 'male', path: p('ml', 'IN', 'arjun') },
  ],
};

/** Is bhasha ki awaaz hai? Nahi to video English awaaz mein bolega (captions apni bhasha mein). */
export function voiceLangFor(lang) {
  return VOICES[lang] ? lang : 'en';
}

/** Profile ke gender ke hisaab se pehli matching awaaz, warna list ki pehli */
export function defaultVoice(lang, gender) {
  const list = VOICES[voiceLangFor(lang)];
  return (list.find((v) => v.gender === gender) || list[0]).id;
}
