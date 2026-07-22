class SoundService {
  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1): Promise<void> {
    return new Promise((resolve) => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);

        // Close the context as soon as the sound is done — prevents
        // Android from showing the persistent Chrome media notification
        osc.onended = () => {
          ctx.close().then(resolve).catch(resolve);
        };
      } catch {
        resolve();
      }
    });
  }

  public playSuccess() {
    this.playTone(880, 0.1, 'sine', 0.2);
  }

  public playBeep() {
    this.playTone(1200, 0.05, 'square', 0.1);
  }

  public playError() {
    this.playTone(200, 0.3, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.2), 100);
  }

  public playSaleComplete() {
    this.playTone(523.25, 0.1);
    setTimeout(() => this.playTone(659.25, 0.1), 100);
    setTimeout(() => this.playTone(783.99, 0.2), 200);
  }
}

export const soundService = new SoundService();
