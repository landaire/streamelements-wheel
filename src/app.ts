declare const __INLINE_CSS__: string;

import type { EventReceivedDetail, WidgetLoadDetail } from "./se/types.js";
import type { ConfigError } from "./config/errors.js";
import { parseConfig } from "./config/parse.js";
import { buildWheel } from "./render/wheel.js";
import { addChrome } from "./render/chrome.js";
import { createAnimator } from "./spin/animator.js";
import { createAudio, type AudioEngine } from "./audio/engine.js";
import { createConfetti } from "./fx/confetti.js";
import { consoleAnnounceSink } from "./se/sinks.js";
import { onEventReceived, onWidgetLoad } from "./se/bootstrap.js";
import type { Rng } from "./model/spin.js";

export { FIELD_DEFS, buildFieldsSchema } from "./config/fields.js";
export { parseConfig } from "./config/parse.js";

// Default confetti palette; configurable in a later phase.
const CONFETTI_COLORS: [string, string, string] = ["#ffc3ce", "#f8acbb", "#ffe3c3"];

function mountStyles(doc: Document): void {
  if (doc.getElementById("wheel-styles")) return;
  const style = doc.createElement("style");
  style.id = "wheel-styles";
  style.textContent = typeof __INLINE_CSS__ === "string" ? __INLINE_CSS__ : "";
  doc.head.appendChild(style);
}

export interface MountOpts {
  rng?: Rng;
  audioCtxFactory?: () => AudioContext;
}

export interface MountHandle {
  root: HTMLElement;
  spin(): void;
  spinCommand: string;
}

export function mountWidget(
  doc: Document,
  detail: WidgetLoadDetail,
  opts: MountOpts = {},
): MountHandle | { error: ConfigError[] } {
  mountStyles(doc);
  const parsed = parseConfig(detail.fieldData);
  if (parsed.kind === "error") {
    const panel = doc.createElement("div");
    panel.className = "wheel-error";
    panel.textContent = "Wheel config error: " + parsed.errors.map((e) => e.kind).join(", ");
    doc.body.appendChild(panel);
    return { error: parsed.errors };
  }
  const cfg = parsed.value;

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
  );

  doc.body.appendChild(dom.container);
  // Fit the hub text now that the widget has real layout (addChrome's fit ran before
  // attach and no-oped); rAF covers a late first paint.
  chrome.refitHub();
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => chrome.refitHub());
  return { root: dom.container, spin: () => animator.spin(), spinCommand: cfg.spinCommand };
}

// Module-scoped SE mount state, populated once StreamElements dispatches onWidgetLoad.
let seHandle: MountHandle | { error: ConfigError[] } | undefined;
let seChannel: WidgetLoadDetail["channel"];

function isBroadcasterOrMod(data: NonNullable<NonNullable<EventReceivedDetail["event"]>["data"]>): boolean {
  const nick = (data.nick ?? data.displayName ?? "").toLowerCase();
  const isBroadcaster = nick.length > 0 && nick === (seChannel?.username ?? "").toLowerCase();
  const isMod =
    data.tags?.mod === "1" ||
    /broadcaster|moderator/.test(String(data.tags?.badges ?? "")) ||
    Boolean(data.badges && (data.badges.broadcaster || data.badges.moderator));
  return isBroadcaster || isMod;
}

// Bound unconditionally: a window listener is harmless outside SE, and the demo/preview
// page calls mountWidget directly without ever dispatching onWidgetLoad, so there is no
// double-mount risk.
onWidgetLoad((detail) => {
  seHandle = mountWidget(document, detail);
  seChannel = detail.channel;
});

onEventReceived((detail) => {
  const isMessage = detail.listener === "message" || detail.event?.listener === "message";
  const data = detail.event?.data;
  if (!isMessage || !data) return;

  const text = (data.text ?? "").trim().toLowerCase();
  if (!seHandle || !("spin" in seHandle)) return;
  const command = seHandle.spinCommand.trim().toLowerCase();
  if (text !== command) return;
  if (!isBroadcasterOrMod(data)) return;

  seHandle.spin();
});
