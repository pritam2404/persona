# Persona

Daily tasks note karo, analyse karo, kal ka plan pao, aur us plan ka AI coach video banao.
Poori guide: `GUIDE.pdf`.

## Quick start

```powershell
npm install
npm run dev      # laptop: http://localhost:5173
npm run phone    # same WiFi pe phone se kholne ke liye
npm test         # 7 logic tests
npm run build    # dist/ -> static hosting (PWA)
```

Video (Python 3.11):

```powershell
cd video
python -m pip install -r requirements.txt
python make_coach_video.py input\coach-YYYY-MM-DD.txt --photo input\face.jpg --lang hi
```

## Stack

- React 18 + Vite 5, PWA (manifest + service worker), localStorage (no server)
- Node built-in test runner
- Python: edge-tts (voice), Pillow (images), imageio-ffmpeg (video), headless Edge (Hindi/Bengali caption shaping)

## Privacy

- Data sirf device pe. Phone/laptop sync = Export / Import JSON.
- Office tasks hamesha private: unke naam video script mein kabhi nahi jaate (`src/lib/script.js`, test: `coach script never leaks office/private titles`).
- `video/input/`, `video/output/` aur `*.persona.json` backups git mein commit nahi hote.
