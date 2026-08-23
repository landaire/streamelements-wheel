import { describe, it, expect, vi } from "vitest";
import { onWidgetLoad, onEventReceived, hasSEApi } from "../src/se/bootstrap.js";
import { consoleAnnounceSink } from "../src/se/sinks.js";

describe("se integration", () => {
  it("onWidgetLoad forwards the SE event detail to the handler", () => {
    const handler = vi.fn();
    onWidgetLoad(handler);
    const detail = { fieldData: { sliceEntries: "A,B" } };
    window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail }));
    expect(handler).toHaveBeenCalledWith(detail);
  });
  it("onEventReceived forwards the SE event detail to the handler", () => {
    const handler = vi.fn();
    onEventReceived(handler);
    const detail = { listener: "message", event: { data: { text: "!spin" } } };
    window.dispatchEvent(new CustomEvent("onEventReceived", { detail }));
    expect(handler).toHaveBeenCalledWith(detail);
  });
  it("reports SE_API presence", () => {
    expect(typeof hasSEApi()).toBe("boolean");
  });
  it("console announce sink sets winner and seam titles", () => {
    const titles: string[] = [];
    const sink = consoleAnnounceSink((t) => titles.push(t), "spin again");
    sink.winner("Apple");
    sink.seam();
    expect(titles).toEqual(["Apple", "spin again"]);
  });
});
