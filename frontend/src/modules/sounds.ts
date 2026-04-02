// ============================================================
// МОДУЛЬ ЗВУКОВ (sounds.ts)
// ============================================================

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch { return null; }
    }
    return this.ctx;
  }

  private tone(freq: number, dur: number, vol = 0.08): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  playClick()  { this.tone(660, 0.04, 0.07); }
  playAdd()    { this.tone(440, 0.10, 0.09); }
  playDelete() { this.tone(280, 0.12, 0.09); }
  playSuccess() {
    this.tone(523, 0.08, 0.08);
    setTimeout(() => this.tone(659, 0.10, 0.08), 90);
    setTimeout(() => this.tone(784, 0.15, 0.10), 190);
  }
  playError()  { this.tone(200, 0.15, 0.10); }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setEnabled(v: boolean): void { this.enabled = v; }
  isEnabled(): boolean { return this.enabled; }
}

export const soundManager = new SoundManager();
