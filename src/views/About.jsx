/** Kisne banaya, privacy, aur awaaz ke credits (voice licenses ke liye credit zaroori hai). */
export default function About({ onClose }) {
  return (
    <section className="card about" aria-labelledby="about-h">
      <div className="row between">
        <h2 id="about-h">About Persona</h2>
        <button type="button" className="ghost sm" onClick={onClose}>Band karo</button>
      </div>
      <p><strong>Idea, design aur product:</strong> Pritam Saha</p>
      <p className="muted">© 2026 Pritam Saha. All rights reserved.</p>
      <p>
        <a href="https://github.com/pritam2404/persona" target="_blank" rel="noopener noreferrer">GitHub</a>
        {' · '}
        <a href="./privacy.html" target="_blank" rel="noopener noreferrer">Privacy policy</a>
      </p>
      <p className="hint">Tumhara data sirf is device pe rehta hai. Koi account, ads ya tracking nahi.</p>

      <details>
        <summary>Credits (awaaz aur open-source)</summary>
        <ul className="how">
          <li>
            Hindi awaaz: Priyamvada aur Pratham (PravalX, AI4Bharat data, CC BY-NC-SA 4.0),
            Rohan (IIT Madras IndicTTS). Rhasspy Piper project se.
          </li>
          <li>English awaaz: Rhasspy Piper voices.</li>
          <li>Speech engine: Piper TTS, onnxruntime-web (Microsoft), espeak-ng.</li>
          <li>App: React, Vite.</li>
        </ul>
      </details>
    </section>
  );
}
