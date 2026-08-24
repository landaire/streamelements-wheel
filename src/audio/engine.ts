export interface AudioEngine {
  tick(): void;
  win(): void;
  seam(): void;
}

export interface SoundUrls {
  winSound?: string | undefined;
  tickSound?: string | undefined;
  seamSound?: string | undefined;
}

// All sounds are synthesized in code via the Web Audio API and generated on the fly, so the
// widget ships no audio files. A streamer-supplied URL overrides the matching synth.

const FLOOR = 0.0001; // exponential ramps need a positive, non-zero target
const MASTER_GAIN = 0.7;

interface ToneOpts {
  freq: number;
  type: OscillatorType;
  peak: number;
  attackSec: number;
  decaySec: number;
  atSec?: number; // start offset from "now"
  glideToHz?: number; // pitch glide over attack+decay (a "womp")
}

interface NoiseOpts {
  durSec: number;
  filterHz: number;
  q: number;
  peak: number;
  atSec?: number;
}

export function createAudio(ctxFactory: () => AudioContext, cfg: SoundUrls): AudioEngine {
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  const ac = (): AudioContext => {
    if (!ctx) {
      ctx = ctxFactory();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    }
    return ctx;
  };

  const playUrl = (url: string): void => {
    void new Audio(url).play().catch(() => undefined);
  };

  // A single enveloped oscillator note: soft exponential attack then decay to silence.
  const tone = (o: ToneOpts): void => {
    const c = ac();
    const t0 = c.currentTime + (o.atSec ?? 0);
    const end = t0 + o.attackSec + o.decaySec;
    const osc = c.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.glideToHz !== undefined) osc.frequency.exponentialRampToValueAtTime(o.glideToHz, end);
    const gain = c.createGain();
    gain.gain.setValueAtTime(FLOOR, t0);
    gain.gain.exponentialRampToValueAtTime(o.peak, t0 + o.attackSec);
    gain.gain.exponentialRampToValueAtTime(FLOOR, end);
    osc.connect(gain);
    gain.connect(master!);
    osc.start(t0);
    osc.stop(end + 0.02);
  };

  // A short filtered white-noise burst; the click component of a mechanical tick.
  const noise = (o: NoiseOpts): void => {
    const c = ac();
    const t0 = c.currentTime + (o.atSec ?? 0);
    const frames = Math.max(1, Math.floor(c.sampleRate * o.durSec));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = o.filterHz;
    filter.Q.value = o.q;
    const gain = c.createGain();
    gain.gain.setValueAtTime(o.peak, t0);
    gain.gain.exponentialRampToValueAtTime(FLOOR, t0 + o.durSec);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master!);
    src.start(t0);
    src.stop(t0 + o.durSec + 0.01);
  };

  // Ratchet click (~65ms): a broadband onset transient over a ~660Hz struck-body tone,
  // matching the original tick's strong 660Hz fundamental and bright attack.
  const tickSynth = (): void => {
    noise({ durSec: 0.03, filterHz: 3000, q: 0.6, peak: 0.14 });
    tone({ freq: 660, type: "triangle", peak: 0.16, attackSec: 0.002, decaySec: 0.06 });
    tone({ freq: 1320, type: "sine", peak: 0.04, attackSec: 0.002, decaySec: 0.04 });
  };

  // Celebratory chime: a bass impact and bright transient, then an ascending major arpeggio
  // (C6 E6 G6 C7) that rings out ~1.7s with slightly inharmonic shimmer -- the original's
  // impact-plus-ringing-bell shape.
  const winSynth = (): void => {
    tone({ freq: 140, glideToHz: 70, type: "sine", peak: 0.25, attackSec: 0.002, decaySec: 0.3 });
    noise({ durSec: 0.08, filterHz: 3500, q: 0.5, peak: 0.1 });
    const notes = [1047, 1319, 1568, 2093];
    notes.forEach((freq, i) => {
      const atSec = i * 0.06;
      const last = i === notes.length - 1;
      tone({ freq, type: "triangle", peak: 0.14, attackSec: 0.004, decaySec: last ? 1.7 : 1.0, atSec });
      tone({ freq: freq * 2.01, type: "sine", peak: 0.05, attackSec: 0.004, decaySec: last ? 1.4 : 0.8, atSec });
    });
  };

  // On-the-line chime: same impact-plus-ring shape as the win, but a suspended C-F-G cluster
  // struck together (no clear major resolution) so it reads as neutral suspense, not a win
  // and not a fail buzzer -- matching the original's ambiguous sustained bell.
  const seamSynth = (): void => {
    tone({ freq: 120, glideToHz: 66, type: "sine", peak: 0.2, attackSec: 0.003, decaySec: 0.28 });
    noise({ durSec: 0.06, filterHz: 2500, q: 0.5, peak: 0.08 });
    const chord = [1047, 1397, 1568];
    chord.forEach((freq) => {
      tone({ freq, type: "triangle", peak: 0.11, attackSec: 0.005, decaySec: 1.4 });
      tone({ freq: freq * 2.01, type: "sine", peak: 0.035, attackSec: 0.005, decaySec: 1.1 });
    });
  };

  return {
    tick: () => (cfg.tickSound !== undefined ? playUrl(cfg.tickSound) : tickSynth()),
    win: () => (cfg.winSound !== undefined ? playUrl(cfg.winSound) : winSynth()),
    seam: () => (cfg.seamSound !== undefined ? playUrl(cfg.seamSound) : seamSynth()),
  };
}
