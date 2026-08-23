import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import { buildWheel } from "../src/render/wheel.js";
import { addChrome, fitEntryText, refitEntries } from "../src/render/chrome.js";

const cfg = (() => {
  const r = parseConfig({ sliceEntries: "A, B", scaleWidget: 2, centerIcon: "star" });
  if (r.kind !== "ok") throw new Error("bad");
  return r.value;
})();

describe("addChrome", () => {
  it("adds a fixed pointer, centerpiece with icon, and a title", () => {
    const dom = buildWheel(document, cfg);
    const chrome = addChrome(document, dom, cfg);
    expect(dom.container.querySelector(".headpiece")).not.toBeNull();
    expect(dom.container.querySelector(".centerpiece .center-icon.cb-star")).not.toBeNull();
    chrome.setTitle("Winner!");
    expect(chrome.title.textContent).toBe("Winner!");
  });
  it("applies scale to the container", () => {
    const dom = buildWheel(document, cfg);
    addChrome(document, dom, cfg);
    expect(dom.container.style.getPropertyValue("--scale").trim()).toBe("2");
  });

  it("refit no-ops entry text when the container has no live layout (jsdom, pre-attach)", () => {
    const dom = buildWheel(document, cfg);
    const chrome = addChrome(document, dom, cfg);
    const textEl = dom.entries[0]!.querySelector<HTMLElement>(".entry-text")!;
    expect(textEl.style.fontSize).toBe("");
    chrome.refit();
    expect(textEl.style.fontSize).toBe("");
  });
});

describe("fitEntryText", () => {
  it("no-ops when R is 0", () => {
    const dom = buildWheel(document, cfg);
    const textEl = dom.entries[0]!.querySelector<HTMLElement>(".entry-text")!;
    fitEntryText(textEl, 0.25, 0);
    expect(textEl.style.fontSize).toBe("");
    expect(textEl.style.maxWidth).toBe("");
  });

  it("caps radial maxWidth from R and only shrinks toward the base font-size", () => {
    const dom = buildWheel(document, cfg);
    const textEl = dom.entries[0]!.querySelector<HTMLElement>(".entry-text")!;
    fitEntryText(textEl, 0.25, 200);
    expect(textEl.style.maxWidth).toBe(0.56 * 200 + "px");
    // jsdom reports scrollWidth/scrollHeight as 0 (no real text layout), so every
    // candidate size "fits" and the search converges to the base font-size cap.
    expect(Number.parseFloat(textEl.style.fontSize)).toBeLessThanOrEqual(15);
  });
});

describe("refitEntries", () => {
  it("skips entries with no sizeTurn or no live container size", () => {
    const dom = buildWheel(document, cfg);
    addChrome(document, dom, cfg);
    // Not attached to the document, so container.clientWidth is 0 in jsdom.
    refitEntries(dom);
    for (const entry of dom.entries) {
      const textEl = entry.querySelector<HTMLElement>(".entry-text")!;
      expect(textEl.style.fontSize).toBe("");
    }
  });
});
