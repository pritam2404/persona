/**
 * Web Audio API synthesizer for crisp, zero-latency sounds.
 * Fully hermetic, no external audio assets required.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioNode | null = null;
  private noiseGain: GainNode | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Soothing evening wind-down harmonic chime
  playEveningChime(enabled = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const notes = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4 (warm A Major)

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 1.9);
      });
    } catch {
      // AudioContext policy fallback
    }
  }

  // Energizing morning sunrise chime
  playMorningChime(enabled = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const notes = [392, 493.88, 587.33, 783.99]; // G4, B4, D5, G5 (bright G Major)

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.1 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.5);
      });
    } catch {
      // Ignore audio policy
    }
  }

  // Satisfying task completion chime
  playTaskCompleteSound(enabled = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Ignore
    }
  }

  // Timer complete alert
  playTimerDoneSound(enabled = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      [0, 0.2, 0.4].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + delay);

        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.2, now + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.2);
      });
    } catch {
      // Ignore
    }
  }

  // Toggle ambient brown/rain noise for deep focus
  toggleFocusNoise(shouldPlay: boolean): boolean {
    try {
      const ctx = this.getContext();

      if (!shouldPlay) {
        if (this.noiseNode) {
          (this.noiseNode as unknown as { stop?: () => void }).stop?.();
          this.noiseNode.disconnect();
          this.noiseNode = null;
        }
        return false;
      }

      if (this.noiseNode) return true;

      // Generate brown noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // gain boost
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = 0.03; // quiet ambient

      // Low pass filter to create deep rain/café hum
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      this.noiseNode = whiteNoise;
      this.noiseGain = gain;
      return true;
    } catch {
      return false;
    }
  }

  // Voice narration for morning briefing
  speakText(text: string, lang: 'en' | 'hi' = 'en'): boolean {
    if (!('speechSynthesis' in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const soundEngine = new SoundEngine();
