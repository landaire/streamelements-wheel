declare const __INLINE_CSS__: string;

import type { WidgetLoadDetail } from "./se/types.js";
import type { ConfigError } from "./config/errors.js";
import { parseConfig } from "./config/parse.js";
import { applyImportedConfig } from "./config/import.js";
import { buildWidget } from "./app/builder.js";
import { createController, type WheelController } from "./app/controller.js";
import { onEventReceived, onWidgetLoad } from "./se/bootstrap.js";
import type { Rng } from "./model/spin.js";

export { FIELD_DEFS, buildFieldsSchema } from "./config/fields.js";
export { parseConfig } from "./config/parse.js";

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

function renderConfigErrorPanel(doc: Document, errors: ConfigError[]): void {
  const panel = doc.createElement("div");
  panel.className = "wheel-error";
  panel.textContent = "Wheel config error: " + errors.map((e) => e.kind).join(", ");
  doc.body.appendChild(panel);
}

export function mountWidget(
  doc: Document,
  detail: WidgetLoadDetail,
  opts: MountOpts = {},
): MountHandle | { error: ConfigError[] } {
  mountStyles(doc);
  const parsed = parseConfig(applyImportedConfig(detail.fieldData));
  if (parsed.kind === "error") {
    renderConfigErrorPanel(doc, parsed.errors);
    return { error: parsed.errors };
  }
  const cfg = parsed.value;
  const built = buildWidget(doc, cfg, opts);

  doc.body.appendChild(built.container);
  // Fit hub text and slice labels now that the widget has real layout (addChrome's fit
  // ran before attach and no-oped); rAF covers a late first paint.
  built.refit();
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => built.refit());
  return { root: built.container, spin: () => built.spin(), spinCommand: cfg.spinCommand };
}

// Module-scoped SE mount state, populated once StreamElements dispatches onWidgetLoad.
// The controller (not mountWidget) owns the live SE mount, since it needs mutable
// slices for chat commands and channel-point redemptions; mountWidget stays a plain,
// one-shot build for the demo/preview page.
let controller: WheelController | undefined;
let seChannel: WidgetLoadDetail["channel"];

// Bound unconditionally: a window listener is harmless outside SE, and the demo/preview
// page calls mountWidget directly without ever dispatching onWidgetLoad, so there is no
// double-mount risk.
onWidgetLoad((detail) => {
  mountStyles(document);
  seChannel = detail.channel;
  const created = createController(document, document.body, detail);
  if ("error" in created) {
    renderConfigErrorPanel(document, created.error);
    return;
  }
  controller = created;
});

onEventReceived((detail) => {
  if (!controller) return;

  const isMessage = detail.listener === "message" || detail.event?.listener === "message";
  const data = detail.event?.data;
  if (isMessage && data && typeof data.text === "string") {
    controller.handleChatMessage(data.text, data, seChannel?.username);
    return;
  }
  controller.handleRedemption(detail);
});
