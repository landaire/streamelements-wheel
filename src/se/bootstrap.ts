import type { EventReceivedDetail, WidgetLoadDetail } from "./types.js";

declare const SE_API: unknown;

export function hasSEApi(): boolean {
  return typeof SE_API !== "undefined";
}

export function onWidgetLoad(handler: (detail: WidgetLoadDetail) => void): void {
  window.addEventListener("onWidgetLoad", (e: Event) => {
    const detail = (e as CustomEvent<WidgetLoadDetail>).detail;
    handler(detail);
  });
}

export function onEventReceived(handler: (detail: EventReceivedDetail) => void): void {
  window.addEventListener("onEventReceived", (e: Event) => {
    const detail = (e as CustomEvent<EventReceivedDetail>).detail;
    handler(detail);
  });
}
