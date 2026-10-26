// Video ki awaaz ke options (halki file - bhaari TTS library alag tts.js mein, jo sirf
// "Video banao" dabane pe load hoti hai).
// Hindi models original Rhasspy Piper repo se (library ki apni list mein Hindi nahi hai).
// Library path ko "HF_BASE/<path>" banati hai; '../../../../' se huggingface.co ke root pe
// aa jaate hain, phir rhasspy ka path (browser URL khud normalise kar deta hai).
const RHASSPY = '../../../../rhasspy/piper-voices/resolve/main';

export const VOICES = {
  hi: [
    { id: 'hi_IN-priyamvada-medium', label: 'Priyamvada (female)', path: `${RHASSPY}/hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx` },
    { id: 'hi_IN-pratham-medium', label: 'Pratham (male)', path: `${RHASSPY}/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx` },
    { id: 'hi_IN-rohan-medium', label: 'Rohan (male)', path: `${RHASSPY}/hi/hi_IN/rohan/medium/hi_IN-rohan-medium.onnx` },
  ],
  en: [
    { id: 'en_US-hfc_female-medium', label: 'HFC (female)' },
    { id: 'en_GB-alan-medium', label: 'Alan (male)' },
  ],
};
