# Third-party notices

Persona uses these open-source components. Each keeps its own license.

## Code libraries
| Component | Used for | License |
|---|---|---|
| React, React DOM | User interface | MIT |
| Vite | Build tool | MIT |
| @mintplex-labs/piper-tts-web | Text-to-speech in the browser | MIT |
| onnxruntime-web (Microsoft) | Runs the voice model | MIT |
| Piper / piper-phonemize (Rhasspy), espeak-ng data | Speech engine and pronunciation | MIT / GPL-3.0 (espeak-ng) |

## Voice models (downloaded at runtime, not stored in this repository)
| Voice | Source | License |
|---|---|---|
| hi_IN-priyamvada-medium | Rhasspy piper-voices, trained by PravalX on AI4Bharat data | CC BY-NC-SA 4.0 (non-commercial) |
| hi_IN-pratham-medium | Rhasspy piper-voices, trained by PravalX on AI4Bharat data | CC BY-NC-SA 4.0 (non-commercial) |
| hi_IN-rohan-medium | Rhasspy piper-voices, IIT Madras IndicTTS "Hindi Mono Male" | IndicTTS license (see iitm.ac.in/donlab/indictts) |
| en_US-hfc_female-medium, en_GB-alan-medium | Rhasspy piper-voices | See each voice's MODEL_CARD on Hugging Face |
| bn_BD-google-medium | Rhasspy piper-voices (Google Bangla data) | CC BY-SA 4.0 |
| te_IN-padmavathi-medium, te_IN-venkatesh-medium | Rhasspy piper-voices | CC BY 4.0 |
| te_IN-maya-medium | Rhasspy piper-voices, IIT Madras IndicTTS | IndicTTS license |
| ml_IN-meera-medium, ml_IN-arjun-medium | Rhasspy piper-voices | See MODEL_CARD |

Translations for bn, pa, kn, ta, te, ml were machine-assisted and should be reviewed by native speakers.

**Important:** the Hindi voices are licensed for **non-commercial** use only. If Persona is
ever monetised (ads, paid plan, paid app), these voices must be replaced with commercially
licensed ones.
