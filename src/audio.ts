// Toàn bộ âm thanh được tổng hợp bằng Web Audio API, không dùng file âm thanh nào

class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  ambient: GainNode | null = null;
  muted = false;
  private noiseBuf!: AudioBuffer;
  private ambientTimer: number | null = null;
  private stepTimer: number | null = null;

  /** Phải gọi sau một thao tác của người dùng (chính sách tự phát của trình duyệt) */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private noise(dur: number, filterType: BiquadFilterType, freq: number, q: number, gain: number, when = 0, freqEnd?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, freqEnd?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- Hiệu ứng ----------
  click() { this.noise(0.03, 'highpass', 3000, 1, 0.25); }
  key() { this.noise(0.025 + Math.random() * 0.02, 'bandpass', 2500 + Math.random() * 2500, 2, 0.12 + Math.random() * 0.08); }
  ting() { this.tone(1318, 0.25, 'sine', 0.25); this.tone(1760, 0.35, 'sine', 0.2, 0.09); }
  tingBurst() { for (let i = 0; i < 5; i++) { this.tone(1318, 0.18, 'sine', 0.22, i * 0.16); this.tone(1760, 0.22, 'sine', 0.18, i * 0.16 + 0.07); } }
  taskDone() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, i * 0.07)); }
  fail() { this.tone(220, 0.25, 'square', 0.12); this.tone(165, 0.3, 'square', 0.12, 0.12); }
  tear() {
    for (let i = 0; i < 6; i++) this.noise(0.07, 'bandpass', 1800 + Math.random() * 2500, 3, 0.5, i * 0.05);
    this.noise(0.4, 'highpass', 2500, 1, 0.3, 0, 6000);
  }
  stamp() { this.tone(110, 0.22, 'sine', 0.8, 0, 50); this.noise(0.12, 'lowpass', 800, 1, 0.6); }
  bang() { this.tone(90, 0.12, 'square', 0.3, 0, 60); this.noise(0.1, 'lowpass', 1200, 1, 0.5); }
  alarm() { for (let i = 0; i < 6; i++) this.tone(i % 2 ? 660 : 880, 0.22, 'sawtooth', 0.1, i * 0.24); }
  powerDown() { this.tone(300, 0.9, 'sawtooth', 0.12, 0, 40); }
  powerUp() { this.tone(80, 0.6, 'sawtooth', 0.1, 0, 400); }
  modem() { for (let i = 0; i < 8; i++) this.tone(900 + Math.random() * 1400, 0.08, 'square', 0.05, i * 0.07); }
  sip() { this.noise(0.5, 'bandpass', 900, 4, 0.15, 0, 500); }
  whoosh() { this.noise(0.35, 'bandpass', 400, 1.5, 0.35, 0, 2400); }
  sigh() { this.noise(1.1, 'bandpass', 700, 2.5, 0.12, 0, 260); }
  cough() { this.noise(0.12, 'bandpass', 500, 2, 0.35); this.noise(0.15, 'bandpass', 420, 2, 0.3, 0.2); }
  footstep() { this.tone(70, 0.1, 'sine', 0.6, 0, 45); this.noise(0.05, 'highpass', 2000, 1, 0.3); }

  startAmbient() {
    if (!this.ctx || this.ambient) return;
    // tiếng máy lạnh ù ù
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const hum = this.ctx.createOscillator(); hum.frequency.value = 58; hum.type = 'sine';
    const hg = this.ctx.createGain(); hg.gain.value = 0.03;
    this.ambient = this.ctx.createGain(); this.ambient.gain.value = 0.18;
    src.connect(f); f.connect(this.ambient); hum.connect(hg); hg.connect(this.ambient);
    this.ambient.connect(this.master);
    src.start(); hum.start();
    // tiếng gõ phím, click chuột, thở dài, ho hắng thỉnh thoảng
    const loop = () => {
      const r = Math.random();
      if (r < 0.55) { const n = 3 + Math.floor(Math.random() * 8); for (let i = 0; i < n; i++) setTimeout(() => this.key(), i * (60 + Math.random() * 90)); }
      else if (r < 0.8) this.click();
      else if (r < 0.9) this.sigh();
      else this.cough();
      this.ambientTimer = window.setTimeout(loop, 900 + Math.random() * 2600);
    };
    loop();
  }

  ambientLevel(v: number) {
    if (this.ambient && this.ctx) this.ambient.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  // ---------- Nhạc nền sảnh chờ: điệu nhạc văn phòng vui vẻ, tự sáng tác bằng code ----------
  private music: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicNext = 0;
  private musicStep = 0;
  musicOn = true;

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.2);
  }

  private track: 'lobby' | 'title' = 'lobby';
  startMusic(track: 'lobby' | 'title' = 'lobby') {
    if (!this.ctx) return;
    if (this.musicTimer !== null && this.track === track) return;
    if (this.musicTimer !== null) this.stopMusic();
    this.track = track;
    this.music = this.ctx.createGain();
    this.music.gain.value = 0;
    this.music.gain.setTargetAtTime(this.musicOn ? 0.16 : 0, this.ctx.currentTime, 0.5);
    this.music.connect(this.master);
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 80);
  }

  stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (this.music && this.ctx) {
      const g = this.music; g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      setTimeout(() => g.disconnect(), 1200);
    }
    this.music = null;
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  private scheduleMusic() {
    if (!this.ctx || !this.music) return;
    if (this.track === 'title') { this.scheduleTitle(); return; }
    const beat = 60 / 116 / 2; // nốt móc đơn, 116 BPM
    // Vòng hợp âm C – Am – F – G, giai điệu ngũ cung nhí nhảnh
    const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    const bass = [130.8, 110, 87.3, 98];
    const mel = [
      784, 0, 659, 784, 880, 0, 784, 659,   587, 0, 659, 0, 523, 587, 659, 0,
      698, 0, 659, 587, 523, 0, 587, 659,   587, 0, 523, 0, 494, 523, 587, 0,
    ];
    while (this.musicNext < this.ctx.currentTime + 0.25) {
      const t = this.musicNext, st = this.musicStep;
      const bar = Math.floor(st / 8) % 4, inBar = st % 8;
      if (inBar % 4 === 0) this.note(bass[bar], t, beat * 3, 'triangle', 0.5);
      if (inBar % 4 === 2) this.note(bass[bar] * 2, t, beat, 'triangle', 0.25);
      if (inBar === 2 || inBar === 6) for (const f of chords[bar]) this.note(f, t, beat * 1.2, 'square', 0.035);
      const m = mel[st % mel.length];
      if (m && Math.floor(st / 32) % 2 === 0) this.note(m, t, beat * 0.9, 'triangle', 0.18);
      if (m && Math.floor(st / 32) % 2 === 1) this.note(m * 1.5 > 1200 ? m : m, t, beat * 0.9, 'sine', 0.14);
      // trống nhẹ: kick đầu phách, hi-hat móc
      if (inBar % 4 === 0) { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.2); }
      if (inBar % 2 === 1) {
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(f); f.connect(g); g.connect(this.music); src.start(t, Math.random(), 0.06);
      }
      this.musicNext += beat;
      this.musicStep++;
    }
  }

  /** Nhạc màn hình chính: chậm, mơ màng kiểu "chiều thứ Sáu sắp tan ca" */
  private scheduleTitle() {
    if (!this.ctx || !this.music) return;
    const beat = 60 / 92 / 2;
    const chords = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [196, 246.9, 293.7, 349.2]]; // Fmaj7 Em7 Dm7 G7
    const bass = [87.3, 82.4, 73.4, 98];
    const mel = [
      659, 0, 0, 587, 523, 0, 587, 0,   494, 0, 0, 523, 587, 0, 0, 0,
      523, 0, 0, 494, 440, 0, 494, 523, 587, 0, 659, 0, 587, 0, 0, 0,
    ];
    while (this.musicNext < this.ctx.currentTime + 0.25) {
      const t = this.musicNext, st = this.musicStep;
      const bar = Math.floor(st / 8) % 4, inBar = st % 8;
      if (inBar === 0) { this.note(bass[bar], t, beat * 6, 'sine', 0.55); for (const f of chords[bar]) this.note(f, t, beat * 7.5, 'triangle', 0.05); }
      if (inBar === 4) this.note(bass[bar] * 1.5, t, beat * 3, 'sine', 0.3);
      // tiếng chuông nhỏ rải hợp âm
      if (inBar % 2 === 1) this.note(chords[bar][(st >> 1) % 4] * 2, t, beat * 1.5, 'sine', 0.06);
      const m = mel[st % mel.length];
      if (m && Math.floor(st / 32) % 4 !== 3) this.note(m, t, beat * 1.8, 'triangle', 0.16);
      if (inBar === 4) {
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        src.connect(f); f.connect(g); g.connect(this.music); src.start(t, Math.random(), 0.14);
      }
      if (inBar === 0) { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25); }
      this.musicNext += beat;
      this.musicStep++;
    }
  }

  startBossSteps() {
    this.stopBossSteps();
    let i = 0;
    const step = () => { this.footstep(); i++; this.stepTimer = window.setTimeout(step, i % 2 ? 420 : 520); };
    step();
  }
  stopBossSteps() { if (this.stepTimer) { clearTimeout(this.stepTimer); this.stepTimer = null; } }
}

export const sfx = new Sound();
