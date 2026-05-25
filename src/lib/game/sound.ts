// ═══════════════════════════════════════════════════════════════
// SOUND SYSTEM  — Web Audio API synth bleeps
// ═══════════════════════════════════════════════════════════════
class SoundSystem {
  private _ctx: AudioContext | null = null;
  private _muted = false;

  private _ensure(): AudioContext | null {
    if (this._muted) return null;
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)(); } catch { return null; }
    }
    return this._ctx;
  }

  get muted() { return this._muted; }
  toggleMute() { this._muted = !this._muted; return this._muted; }

  private _tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.10, delay = 0) {
    const ctx = this._ensure(); if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(vol,    ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime  + delay + dur + 0.02);
    } catch { /* ignore Safari quirks */ }
  }

  private _noise(dur: number, vol = 0.1, delay = 0) {
    const ctx = this._ensure(); if (!ctx) return;
    try {
      const n   = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src  = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      src.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol,   ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
      src.start(ctx.currentTime + delay);
    } catch { /* ignore */ }
  }

  // ── Named events ──────────────────────────────────────────
  unitSelected()  { this._tone(900, 0.05, 'square',   0.07); }
  moveOrder()     { this._tone(660, 0.07, 'square',   0.07); this._tone(880, 0.04, 'square', 0.05, 0.06); }
  attackOrder()   { this._tone(440, 0.05, 'sawtooth', 0.07); this._tone(330, 0.07, 'sawtooth',0.06, 0.04); }
  buildPlace()    { this._tone(1200, 0.09,'sine',     0.08); this._tone(1600, 0.07,'sine',    0.07, 0.08); }
  unitReady()     { this._tone(880,  0.07,'sine',     0.10); this._tone(1320, 0.06,'sine',    0.09, 0.10); }
  waveAlert()     { this._tone(440,  0.14,'sawtooth', 0.09); this._tone(330,  0.26,'sawtooth',0.10, 0.12); }
  // ── Throttle cooldowns ────────────────────────────────────
  private _unitFireCd  = 0;
  private _tankFireCd  = 0;
  private _prodHumCd   = 0;

  /** Triumphant chime when a building finishes constructing. */
  buildComplete() {
    this._tone(880,  0.09, 'sine', 0.09);
    this._tone(1100, 0.09, 'sine', 0.09, 0.09);
    this._tone(1400, 0.13, 'sine', 0.10, 0.18);
  }

  /** Small-arms crack — globally throttled to ~5/sec so it stays ambient. */
  unitFire() {
    const now = Date.now();
    if (now - this._unitFireCd < 200) return;
    this._unitFireCd = now;
    this._noise(0.05, 0.055);
    this._tone(480, 0.03, 'square', 0.030, 0.01);
  }

  /** Heavy-weapon thud — throttled to ~2/sec so overlapping shots merge. */
  tankFire() {
    const now = Date.now();
    if (now - this._tankFireCd < 450) return;
    this._tankFireCd = now;
    this._noise(0.14, 0.085);
    this._tone(88, 0.26, 'sawtooth', 0.075, 0.05);
  }

  /** Low mechanical hum — throttled to every ~2.5 s, plays while anything is producing. */
  productionHum() {
    const now = Date.now();
    if (now - this._prodHumCd < 2400) return;
    this._prodHumCd = now;
    this._tone(110, 0.35, 'sine', 0.028);
    this._tone(130, 0.25, 'sine', 0.018, 0.12);
  }

  private _lowPowerCd = 0;
  lowPower()      {
    const now = Date.now();
    if (now - this._lowPowerCd < 7000) return;   // at most once per 7 s
    this._lowPowerCd = now;
    this._tone(220, 0.22, 'square', 0.032);       // short, quiet blip
  }
  explosion()     { this._noise(0.22, 0.14); this._tone(100, 0.18, 'sawtooth', 0.07, 0.02); }
  captureNode()   { this._tone(1100, 0.10,'sine',     0.09); this._tone(1400, 0.09,'sine',    0.08, 0.09); }
  artilleryFire() { this._noise(0.38, 0.16); this._tone(80, 0.45, 'sawtooth', 0.11, 0.10); }
  empBlast()      { this._tone(200,  0.46,'square',   0.11); this._tone(100,  0.70,'square',  0.08, 0.18); }
  reinforcements(){ this._tone(660,  0.10,'sine',     0.10); this._tone(880,  0.10,'sine',    0.09, 0.08); this._tone(1100,0.10,'sine',0.10,0.16); }
  upgrade()       { this._tone(800,  0.09,'sine',     0.09); this._tone(1000, 0.09,'sine',    0.08, 0.07); this._tone(1200,0.12,'sine',0.09,0.14); }
  veteranUp()     { this._tone(1400, 0.09,'sine',     0.09); this._tone(1600, 0.12,'sine',    0.09, 0.07); }
  missionWon()    { this._tone(660,0.12,'sine',0.10); this._tone(880,0.12,'sine',0.10,0.10); this._tone(1100,0.18,'sine',0.12,0.20); }
  missionLost()   { this._tone(330,0.22,'sawtooth',0.10); this._tone(220,0.30,'sawtooth',0.09,0.18); }
}

export const sound = new SoundSystem();
