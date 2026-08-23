import type { WidgetLoadDetail } from "./types.js";

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
