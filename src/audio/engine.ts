export interface AudioEngine {
  tick(): void;
  win(): void;
}

const TICK_FREQ_HZ = 1100; // short high click, audible over a spin
const TICK_MS = 30; // duration of tick pulse
const CHIME_FREQ_HZ = 660; // lower frequency for win chime
const CHIME_MS = 220; // longer duration for audible chime
const GAIN_PEAK = 0.2; // initial gain to avoid clipping
const GAIN_FLOOR = 0.0001; // exponential-ramp target; must be > 0

export function createAudio(ctxFactory: () => AudioContext, cfg: { winSound?: string | undefined }): AudioEngine {
  let ctx: AudioContext | undefined;
  const ac = (): AudioContext => (ctx ??= ctxFactory());

  const beep = (freq: number, ms: number): void => {
    const c = ac();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(GAIN_PEAK, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, c.currentTime + ms / 1000);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + ms / 1000);
  };

  return {
    tick: () => beep(TICK_FREQ_HZ, TICK_MS),
    win: () => {
      if (cfg.winSound !== undefined) {
        void new Audio(cfg.winSound).play().catch(() => undefined);
        return;
      }
      beep(CHIME_FREQ_HZ, CHIME_MS);
    },
  };
}
