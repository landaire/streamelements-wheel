declare const __INLINE_CSS__: string;

import type { WidgetLoadDetail, FieldData } from "./se/types.js";
import type { ConfigError } from "./config/errors.js";
import { parseConfig } from "./config/parse.js";
import { applyImportedConfig } from "./config/import.js";
import { buildWidget } from "./app/builder.js";
import { createController, type WheelController } from "./app/controller.js";
import { onEventReceived, onWidgetLoad, hasSEApi } from "./se/bootstrap.js";
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
let seLoaded = false; // an onWidgetLoad-driven controller mount has happened
let fallbackMounted = false; // the boilerplate fallback (below) has mounted

// A boilerplate page may set window.WHEEL_CONFIG to a shared config code so the widget can
// be configured without the SE Fields panel.
function globalConfigCode(): string | undefined {
  const g = (globalThis as { WHEEL_CONFIG?: unknown }).WHEEL_CONFIG;
  return typeof g === "string" ? g : undefined;
}

// A global config code seeds importConfig, unless the Fields panel already set one (an
// explicit field wins).
function withGlobalCode(fieldData: FieldData): FieldData {
  const code = globalConfigCode();
  if (code === undefined) return fieldData;
  const existing = fieldData.importConfig;
  if (typeof existing === "string" && existing.length > 0) return fieldData;
  return { ...fieldData, importConfig: code };
}

function mountController(detail: WidgetLoadDetail): void {
  mountStyles(document);
  seChannel = detail.channel;
  const created = createController(document, document.body, { ...detail, fieldData: withGlobalCode(detail.fieldData) });
  if ("error" in created) {
    renderConfigErrorPanel(document, created.error);
    return;
  }
  controller = created;
  seLoaded = true;
}

// Bound unconditionally: a window listener is harmless outside SE, and the demo/preview
// page calls mountWidget directly without ever dispatching onWidgetLoad, so there is no
// double-mount risk. Skipped only if the boilerplate fallback already mounted (a rare
// missed-event race), so the two paths never both mount.
onWidgetLoad((detail) => {
  if (fallbackMounted) return;
  mountController(detail);
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

// Boilerplate/standalone entry. Only runs when a global config code is present, so the demo
// (which sets no global and mounts explicitly) is untouched. In SE the onWidgetLoad handler
// above drives the controller with chat commands; this fires only as a fallback if that
// event was missed. Outside SE (OBS / self-hosted) there is no onWidgetLoad, so mount a
// one-shot widget and let a click spin it.
if (typeof document !== "undefined" && globalConfigCode() !== undefined) {
  const start = (): void => {
    if (seLoaded || fallbackMounted) return;
    fallbackMounted = true;
    const importConfig = globalConfigCode() ?? "";
    if (hasSEApi()) {
      mountController({ fieldData: { importConfig } });
    } else {
      const handle = mountWidget(document, { fieldData: { importConfig } });
      if ("spin" in handle) document.body.addEventListener("click", () => handle.spin());
    }
  };
  // In SE, give onWidgetLoad a moment to arrive first; standalone can mount immediately.
  const schedule = (): void => {
    window.setTimeout(start, hasSEApi() ? 1500 : 0);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();
}
