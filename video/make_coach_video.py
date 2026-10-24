"""
Persona - Coach Video maker.

Persona app se download ki hui script (coach-YYYY-MM-DD.txt) + ek photo se video banata hai.

Ye 3 cheezein banata hai (output/<script-naam>/ folder mein):
  1. voice.mp3        -> poori script ki AI awaaz (free Microsoft neural voice, edge-tts)
  2. coach.mp4        -> 1080x1920 video: tumhari photo (halka zoom) + neeche captions + awaaz
  3. face_square.png  -> photo ka saaf square crop - lip-sync tool mein upload karne ke liye

REALISTIC LIP-SYNC (hoth hilna) is PC pe nahi hota - uske liye GPU chahiye.
face_square.png + voice.mp3 ko lip-sync tool mein do. README.md dekho.

Chalane ka tarika:
  python make_coach_video.py input/coach-2026-10-23.txt --photo input/face.jpg --lang hi
  python make_coach_video.py input/coach-2026-10-23.txt --lang en        (bina photo -> gradient)

Zaroori libraries (Shorts Studio wali hi):  python -m pip install -r requirements.txt
"""

import argparse
import asyncio
import os
import subprocess
import sys
import tempfile
import textwrap

try:
    import edge_tts
    from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
    import imageio_ffmpeg
except ImportError:
    print("\n[!] Libraries missing hain. Pehle chalao:\n    python -m pip install -r requirements.txt\n")
    sys.exit(1)

WIDTH, HEIGHT = 1080, 1920
FPS = 25
VOICES = {
    "hi": "hi-IN-SwaraNeural",
    "en": "en-IN-NeerjaNeural",
    "bn": "bn-IN-TanishaaNeural",
}
# Male awaaz chahiye to:  --voice hi-IN-MadhurNeural  /  en-IN-PrabhatNeural
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


# ---------------------------------------------------------------- script
def read_script(path):
    with open(path, "r", encoding="utf-8") as f:
        lines = [ln.strip() for ln in f if ln.strip() and not ln.strip().startswith("#")]
    if len(lines) < 2:
        print("[!] Script mein title + kam se kam ek line chahiye.")
        sys.exit(1)
    return lines[0], lines[1:]


# ---------------------------------------------------------------- awaaz
async def _tts(text, voice, out, rate, pitch):
    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(out)


# Thoda dheere + halka neecha pitch = kam robotic, zyada "baat karne" jaisa
TTS_RATE = "-7%"
TTS_PITCH = "-2Hz"
# Har line ke baad saans jaisa gap (seconds). Bina gap ke awaaz bhaagti hui lagti hai.
PAUSE_SEC = 0.55


def tts(text, voice, out, rate=TTS_RATE, pitch=TTS_PITCH):
    try:
        asyncio.run(_tts(text, voice, out, rate, pitch))
    except Exception as e:  # network / 403 wagairah
        print(f"\n[!] Awaaz nahi bani: {e}")
        print("    Internet check karo. 403 error aaye to: python -m pip install -U edge-tts\n")
        sys.exit(1)


def duration(path):
    r = subprocess.run([FFMPEG, "-i", path, "-f", "null", "-"], capture_output=True, text=True)
    dur = 1.5
    for tok in r.stderr.split():
        if tok.startswith("time="):
            try:
                h, m, s = tok[5:].split(":")
                dur = int(h) * 3600 + int(m) * 60 + float(s)
            except ValueError:
                pass
    return max(dur, 1.0)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("[!] ffmpeg error:\n" + r.stderr[-1500:])
        sys.exit(1)


# ---------------------------------------------------------------- images
def font(size, bold=False):
    """Hindi + Bengali + English wala font. Naye Windows pe sirf Nirmala.ttc (collection) hota hai,
    .ttf nahi - isliye collection ke andar se sahi style (Regular/Bold) dhoondte hain."""
    ttc = r"C:\Windows\Fonts\Nirmala.ttc"
    if os.path.exists(ttc):
        want = "Bold" if bold else "Regular"
        fallback = None
        for i in range(8):
            try:
                f = ImageFont.truetype(ttc, size, index=i)
            except OSError:
                break
            family, style = f.getname()
            if family == "Nirmala UI":
                fallback = fallback or f
                if style == want:
                    return f
        if fallback:
            return fallback
    for n in [r"C:\Windows\Fonts\NirmalaB.ttf" if bold else r"C:\Windows\Fonts\Nirmala.ttf",
              r"C:\Windows\Fonts\Nirmala.ttf", r"C:\Windows\Fonts\mangal.ttf"]:
        if os.path.exists(n):
            return ImageFont.truetype(n, size)
    print("[!] Hindi font nahi mila - Hindi text boxes jaisa dikhega.")
    return ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", size)


def make_background(photo_path, out_path):
    """Photo ko 9:16 mein 'cover' crop (2x size, taaki zoom smooth rahe). Photo na ho to gradient."""
    W2, H2 = WIDTH * 2, HEIGHT * 2
    if photo_path:
        img = ImageOps.exif_transpose(Image.open(photo_path)).convert("RGB")
        # chehra aam taur pe upar-beech hota hai -> centering thoda upar
        img = ImageOps.fit(img, (W2, H2), Image.LANCZOS, centering=(0.5, 0.35))
    else:
        img = Image.new("RGB", (1, H2))
        for y in range(H2):
            t = y / H2
            img.putpixel((0, y), (int(30 + 20 * t), int(27 + 10 * t), int(75 + 60 * t)))
        img = img.resize((W2, H2))
    img.save(out_path)


def make_face_square(photo_path, out_path):
    """Lip-sync tools ko saaf, saamne wala chehra chahiye - square crop, 1024px."""
    img = ImageOps.exif_transpose(Image.open(photo_path)).convert("RGB")
    img = ImageOps.fit(img, (1024, 1024), Image.LANCZOS, centering=(0.5, 0.35))
    img.save(out_path)


def find_edge():
    for p in [os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
              os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
              os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe")]:
        if os.path.exists(p):
            return p
    return None


CAPTION_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:{w}px;height:{h}px;background:transparent;overflow:hidden;
  font-family:'Nirmala UI','Segoe UI',sans-serif}}
.shade{{position:absolute;left:0;right:0;bottom:0;height:45%;
  background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,.85))}}
.top{{position:absolute;left:0;right:0;top:0;height:170px;background:rgba(0,0,0,.43);
  color:#c7d2fe;font-weight:700;font-size:50px;line-height:170px;padding:0 54px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.cap{{position:absolute;left:60px;right:60px;bottom:170px;text-align:center;color:#fff;
  font-weight:700;font-size:68px;line-height:1.35;text-shadow:3px 4px 6px rgba(0,0,0,.8)}}
</style></head><body><div class="shade"></div><div class="top">{title}</div>
<div class="cap">{text}</div></body></html>"""


def make_caption_browser(edge, text, title, out_path, work):
    """Browser se caption: Hindi/Bengali ke matra aur joint akshar sahi bante hain
    (Pillow ko iske liye 'raqm' library chahiye jo Windows pe aam taur pe nahi hoti)."""
    import html as _html
    page = os.path.join(work, "cap.html")
    with open(page, "w", encoding="utf-8") as f:
        f.write(CAPTION_HTML.format(w=WIDTH, h=HEIGHT, title=_html.escape(title), text=_html.escape(text)))
    profile = os.path.join(work, "edge-profile")
    subprocess.run([
        edge, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
        f"--user-data-dir={profile}", "--default-background-color=00000000",
        f"--window-size={WIDTH},{HEIGHT}", f"--screenshot={out_path}",
        "file:///" + page.replace("\\", "/"),
    ], capture_output=True, timeout=60)
    return os.path.exists(out_path)


def make_caption(text, title, out_path, work=None, edge=None):
    """Transparent PNG caption. Browser mile to usse (sahi Hindi), warna Pillow se."""
    if edge and work and make_caption_browser(edge, text, title, out_path, work):
        return
    make_caption_pillow(text, title, out_path)


def make_caption_pillow(text, title, out_path):
    """Fallback: Pillow se. Hindi ke matra galat jud sakte hain agar 'raqm' nahi hai."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    # neeche ka dark gradient (text padhne layak rahe, photo pe bhi)
    shade = Image.new("L", (1, HEIGHT))
    for y in range(HEIGHT):
        start = int(HEIGHT * 0.55)
        a = 0 if y < start else int(215 * (y - start) / (HEIGHT - start))
        shade.putpixel((0, y), a)
    shade = shade.resize((WIDTH, HEIGHT))
    black = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    black.putalpha(shade)
    img = Image.alpha_composite(img, black)

    # upar halki patti + title
    top = Image.new("RGBA", (WIDTH, 170), (0, 0, 0, 110))
    img.alpha_composite(top, (0, 0))
    d = ImageDraw.Draw(img)
    tf = font(50, bold=True)
    d.text((54, 58), title, font=tf, fill=(199, 210, 254, 255))

    bf = font(68, bold=True)
    lines = textwrap.wrap(text, width=24)[:5]
    line_h = 92
    y = HEIGHT - 170 - len(lines) * line_h
    for ln in lines:
        w = d.textbbox((0, 0), ln, font=bf)[2]
        x = (WIDTH - w) // 2
        d.text((x + 3, y + 4), ln, font=bf, fill=(0, 0, 0, 200))
        d.text((x, y), ln, font=bf, fill=(255, 255, 255, 255))
        y += line_h
    img.save(out_path)


# ---------------------------------------------------------------- video
def build_clip(bg, cap, audio, dur, start_frame, out):
    """Ek scene: background (dheere zoom) + caption overlay + awaaz."""
    frames = int(dur * FPS) + 1
    # 'on' = output frame number; start_frame jodne se zoom poori video mein lagatar chalta hai
    zoom = f"min(1.0+0.00025*(on+{start_frame}),1.12)"
    vf = (
        f"[0:v]zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:"
        f"s={WIDTH}x{HEIGHT}:fps={FPS}[bg];[bg][1:v]overlay=0:0,format=yuv420p[v]"
    )
    run([
        FFMPEG, "-y", "-loop", "1", "-framerate", str(FPS), "-i", bg,
        "-loop", "1", "-framerate", str(FPS), "-i", cap,
        "-i", audio,
        "-filter_complex", vf, "-map", "[v]", "-map", "2:a",
        "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-t", f"{dur:.2f}", out,
    ])
    return frames


def concat(files, out, work, audio_only=False):
    lst = os.path.join(work, "list_a.txt" if audio_only else "list_v.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for p in files:
            f.write(f"file '{p}'\n")
    if audio_only:
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "libmp3lame", "-b:a", "160k", out])
    else:
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out])


def main():
    ap = argparse.ArgumentParser(description="Persona coach video banao")
    ap.add_argument("script", help="Persona app se download ki gayi .txt script")
    ap.add_argument("--photo", help="Saamne se li hui saaf photo (jpg/png). Optional.")
    ap.add_argument("--lang", default="hi", choices=list(VOICES))
    ap.add_argument("--voice", help="Koi aur edge-tts voice, jaise hi-IN-MadhurNeural")
    ap.add_argument("--rate", default=TTS_RATE, help="Bolne ki speed, jaise -10%% ya +5%%")
    args = ap.parse_args()

    if not os.path.exists(args.script):
        sys.exit(f"[!] Script nahi mili: {args.script}")
    if args.photo and not os.path.exists(args.photo):
        sys.exit(f"[!] Photo nahi mili: {args.photo}")

    voice = args.voice or VOICES[args.lang]
    title, beats = read_script(args.script)
    name = os.path.splitext(os.path.basename(args.script))[0]
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", name)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n=== Persona Coach Video ===\nScript: {args.script}\nScenes: {len(beats)}  Voice: {voice}\n")

    with tempfile.TemporaryDirectory() as work:
        bg = os.path.join(work, "bg.png")
        make_background(args.photo, bg)
        if args.photo:
            make_face_square(args.photo, os.path.join(out_dir, "face_square.png"))

        edge = find_edge()
        if not edge:
            from PIL import features
            if not features.check("raqm") and any(ord(ch) > 0x900 for ch in title + "".join(beats)):
                print("[!] Edge/Chrome nahi mila - Hindi/Bengali captions ke matra galat dikh sakte hain.\n")

        clips, audios, frame = [], [], 0
        for i, beat in enumerate(beats, 1):
            a = os.path.join(work, f"a{i}.mp3")
            tts(beat, voice, a, rate=args.rate)
            cap = os.path.join(work, f"c{i}.png")
            make_caption(beat, title, cap, work=work, edge=edge)
            dur = duration(a) + 0.35
            clip = os.path.join(work, f"v{i}.mp4")
            frame += build_clip(bg, cap, a, dur, frame, clip)
            clips.append(clip)
            audios.append(a)
            print(f"  scene {i}/{len(beats)}  {dur:.1f}s")

        concat(clips, os.path.join(out_dir, "coach.mp4"), work)

        # voice.mp3 (lip-sync ke liye): har line ke beech saans jaisa chhota gap
        gap = os.path.join(work, "gap.mp3")
        run([FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", str(PAUSE_SEC),
             "-c:a", "libmp3lame", "-b:a", "48k", gap])
        spaced = [gap]  # shuru mein bhi chhota gap - chehra bolne se pehle "settle" hota hai
        for i, a in enumerate(audios, 1):
            # TTS har line ke aage-peeche apni khamoshi jodta hai -> kaat do, taaki gap ek jaisa rahe
            trimmed = os.path.join(work, f"t{i}.mp3")
            trim = ("silenceremove=start_periods=1:start_threshold=-45dB,"
                    "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse")
            run([FFMPEG, "-y", "-i", a, "-af", trim, "-ar", "24000", "-ac", "1",
                 "-c:a", "libmp3lame", "-b:a", "96k", trimmed])
            spaced += [trimmed, gap]
        concat(spaced, os.path.join(out_dir, "voice.mp3"), work, audio_only=True)

    print(f"\n[OK] Ho gaya. Files yahan hain:\n  {out_dir}")
    print("  coach.mp4       -> seedha dekh / share kar sakte ho")
    print("  voice.mp3       -> lip-sync tool ke liye awaaz")
    if args.photo:
        print("  face_square.png -> lip-sync tool ke liye photo")
    print("\nRealistic lip-sync ke liye README.md ka 'Step 3' dekho.\n")


if __name__ == "__main__":
    main()
