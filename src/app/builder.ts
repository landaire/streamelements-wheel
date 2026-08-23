import type { WheelConfig } from "../config/parse.js";
import { buildWheel } from "../render/wheel.js";
import { addChrome } from "../render/chrome.js";
import { createAnimator } from "../spin/animator.js";
import { createAudio, type AudioEngine } from "../audio/engine.js";
import { createConfetti } from "../fx/confetti.js";
import { consoleAnnounceSink } from "../se/sinks.js";
import type { Rng } from "../model/spin.js";

// Default confetti palette; configurable in a later phase.
const CONFETTI_COLORS: [string, string, string] = ["#ffc3ce", "#f8acbb", "#ffe3c3"];

export interface BuildOpts {
  rng?: Rng;
  audioCtxFactory?: () => AudioContext;
  // Seeds the animator's rotation accumulator; used on a controller rebuild so the
  // wheel doesn't visually snap back to 0.
  initialRotationDeg?: number;
}

export interface BuiltWidget {
  container: HTMLElement;
  spin(): void;
  isSpinning(): boolean;
  refit(): void;
  currentRotationDeg(): number;
}

// Builds one complete wheel instance (DOM, chrome, audio, confetti, animator) but does
// not attach it to the document -- the caller owns placement (mountWidget appends to
// doc.body directly; WheelController appends into its own slot and can rebuild it).
export function buildWidget(doc: Document, cfg: WheelConfig, opts: BuildOpts = {}): BuiltWidget {
  const canvas = doc.createElement("canvas");
  canvas.className = "confetti";
  canvas.width = 500;
  canvas.height = 500;

  const dom = buildWheel(doc, cfg);
  const chrome = addChrome(doc, dom, cfg);
  dom.container.insertBefore(canvas, dom.container.firstChild);
  // Apply the resolved color scheme's CSS variables onto the container (named palette
  // or custom fields); overrides the :root fallback.
  for (const [k, v] of Object.entries(cfg.scheme.vars)) dom.container.style.setProperty(k, v);

  const initialRotationDeg = opts.initialRotationDeg ?? 0;
  if (initialRotationDeg !== 0) dom.setRotation(initialRotationDeg);

  // No AudioContext in headless/jsdom environments; fall back to a no-op engine
  // rather than constructing an AudioContext that doesn't exist there.
  const audioCtxFactory =
    opts.audioCtxFactory ?? (typeof AudioContext !== "undefined" ? () => new AudioContext() : undefined);
  const audio: AudioEngine =
    audioCtxFactory !== undefined
      ? createAudio(audioCtxFactory, { winSound: cfg.winSound })
      : { tick() {}, win() {} };

  const confetti = createConfetti(
    canvas,
    CONFETTI_COLORS,
    () => performance.now(),
    (cb) => requestAnimationFrame(cb),
  );
  const announce = consoleAnnounceSink(chrome.setTitle, cfg.respinText);

  const tickEnabled = !cfg.disableSound && !cfg.disableTickSound;
  const animator = createAnimator(
    dom,
    cfg,
    {
      onStart: () => chrome.setTitle(cfg.spinningText),
      ...(tickEnabled ? { onTick: () => audio.tick() } : {}),
      onResult: (result) => {
        if (result.kind === "winner") {
          const text = cfg.slices[result.slice as number]!.text;
          announce.winner(text);
          if (!cfg.disableSound) audio.win();
          if (!cfg.disableConfetti) confetti.fire();
        } else {
          announce.seam();
        }
      },
    },
    opts.rng,
    initialRotationDeg,
  );

  return {
    container: dom.container,
    spin: () => animator.spin(),
    isSpinning: () => animator.isSpinning(),
    refit: () => chrome.refit(),
    currentRotationDeg: () => animator.currentRotationDeg(),
  };
}
