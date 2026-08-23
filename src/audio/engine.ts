export interface AudioEngine {
  tick(): void;
  win(): void;
}

const TICK_FREQ_HZ = 1100; // short high click, audible over a spin
const TICK_MS = 30;
const CHIME_FREQ_HZ = 660;
const CHIME_MS = 220;

export function createAudio(ctxFactory: () => AudioContext, cfg: { winSound?: string | undefined }): AudioEngine {
  let ctx: AudioContext | undefined;
  const ac = (): AudioContext => (ctx ??= ctxFactory());

  const beep = (freq: number, ms: number): void => {
    const c = ac();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
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
