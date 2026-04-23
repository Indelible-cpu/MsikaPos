class SoundService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  public playSuccess() {
    this.playTone(880, 0.1, 'sine', 0.2); // A5
  }

  public playBeep() {
    this.playTone(1200, 0.05, 'square', 0.1); // Scanner beep
  }

  public playError() {
    this.playTone(200, 0.3, 'sawtooth', 0.2); // Low buzz
    setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.2), 100);
  }

  public playSaleComplete() {
    this.playTone(523.25, 0.1); // C5
    setTimeout(() => this.playTone(659.25, 0.1), 100); // E5
    setTimeout(() => this.playTone(783.99, 0.2), 200); // G5
  }
}

export const soundService = new SoundService();
