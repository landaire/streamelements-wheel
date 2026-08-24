import type { WheelConfig } from "../config/parse.js";
import { buildWheel } from "../render/wheel.js";
import { addChrome } from "../render/chrome.js";
import { createAnimator } from "../spin/animator.js";
import { createAudio, type AudioEngine } from "../audio/engine.js";
import { createConfetti } from "../fx/confetti.js";
import { consoleAnnounceSink } from "../se/sinks.js";
import { combineLabels } from "../model/combine.js";
import type { Rng } from "../model/spin.js";

// Default confetti palette; configurable in a later phase.
const CONFETTI_COLORS: [string, string, string] = ["#ffc3ce", "#f8acbb", "#ffe3c3"];

// Loads a Google Fonts family by name (idempotent per family). No-op for a blank family
// or when there is no document head (jsdom without a head, headless probes).
function ensureFontLoaded(doc: Document, family: string): void {
  const name = family.trim();
  if (name.length === 0 || !doc.head) return;
  const id = "wheel-font-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (doc.getElementById(id)) return;
  const link = doc.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(name).replace(/%20/g, "+") +
    ":wght@400;700;800&display=swap";
  doc.head.appendChild(link);
}

export interface BuildOpts {
  rng?: Rng;
  audioCtxFactory?: () => AudioContext;
  // Seeds the animator's rotation accumulator; used on a controller rebuild so the
  // wheel doesn't visually snap back to 0.
  initialRotationDeg?: number;
  // Called once a spin fully settles (after the result is announced). The controller uses
  // it to run rebuilds that were deferred while the wheel was spinning.
  onSettle?: () => void;
}

export interface BuiltWidget {
  container: HTMLElement;
  spin(): void;
  isSpinning(): boolean;
  refit(): void;
  currentRotationDeg(): number;
  dispose(): void; // detach listeners/timers so replacing this widget does not leak
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

  // Load and apply the configured font; a blank family keeps the CSS system fallback.
  ensureFontLoaded(doc, cfg.fontFamily);
  if (cfg.fontFamily.length > 0) dom.container.style.setProperty("--wheel-font", cfg.fontFamily);

  const initialRotationDeg = opts.initialRotationDeg ?? 0;
  if (initialRotationDeg !== 0) dom.setRotation(initialRotationDeg);

  // No AudioContext in headless/jsdom environments; fall back to a no-op engine
  // rather than constructing an AudioContext that doesn't exist there.
  const audioCtxFactory =
    opts.audioCtxFactory ?? (typeof AudioContext !== "undefined" ? () => new AudioContext() : undefined);
  const audio: AudioEngine =
    audioCtxFactory !== undefined
      ? createAudio(audioCtxFactory, { winSound: cfg.winSound, tickSound: cfg.tickSound, seamSound: cfg.seamSound, winStyle: cfg.winSoundStyle === "cash" ? "cash" : "chime", winVolume: cfg.winVolume, tickVolume: cfg.tickVolume, seamVolume: cfg.seamVolume })
      : { tick() {}, win() {}, seam() {} };

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
      onStart: () => {
        if (cfg.slotMachineTitle && cfg.slices.length > 0) chrome.setTitle(cfg.slices[0]!.text);
        else chrome.setTitle(cfg.spinningText);
      },
      ...(tickEnabled ? { onTick: () => audio.tick() } : {}),
      // Slot-machine title: the current pointer slice, driven by the live rotation.
      ...(cfg.slotMachineTitle ? { onSpinSlice: (i: number) => chrome.setTitle(cfg.slices[i]?.text ?? "") } : {}),
      onResult: (result) => {
        if (result.kind === "winner") {
          const text = cfg.slices[result.slice as number]!.text;
          announce.winner(text);
          if (!cfg.disableSound) audio.win();
          if (!cfg.disableConfetti) confetti.fire();
        } else if (cfg.seamResult === "both") {
          // On the line counts as both adjacent slices winning. Either sum matching numbered
          // groups, or show both quoted and joined by the configurable text. Then celebrate.
          const a = cfg.slices[result.between[0] as number]!.text;
          const bText = cfg.slices[result.between[1] as number]!.text;
          announce.winner(cfg.seamCombine ? combineLabels(a, bText) : '"' + a + '"' + cfg.seamJoinText + '"' + bText + '"');
          if (!cfg.disableSound) audio.win();
          if (!cfg.disableConfetti) confetti.fire();
        } else {
          announce.seam();
          if (!cfg.disableSound) audio.seam();
        }
        opts.onSettle?.();
      },
    },
    opts.rng,
    initialRotationDeg,
  );

  // Click the wheel to spin it (in addition to chat commands / the demo button). The
  // animator's own guard ignores clicks while a spin is running.
  dom.container.style.cursor = "pointer";
  const onClick = (): void => animator.spin();
  dom.container.addEventListener("click", onClick);

  return {
    container: dom.container,
    spin: () => animator.spin(),
    isSpinning: () => animator.isSpinning(),
    refit: () => chrome.refit(),
    currentRotationDeg: () => animator.currentRotationDeg(),
    dispose: (): void => {
      chrome.dispose();
      dom.container.removeEventListener("click", onClick);
    },
  };
}
