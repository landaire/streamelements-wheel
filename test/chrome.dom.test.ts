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
  it("sets a positive fit scale on the container, proportional to cfg.scale", () => {
    const dom2 = buildWheel(document, cfg); // scaleWidget 2
    addChrome(document, dom2, cfg);
    const s2 = parseFloat(dom2.container.style.getPropertyValue("--fit-scale"));
    expect(s2).toBeGreaterThan(0);
    const cfg1 = (() => {
      const r = parseConfig({ sliceEntries: "A, B", scaleWidget: 1 });
      if (r.kind !== "ok") throw new Error("bad");
      return r.value;
    })();
    const dom1 = buildWheel(document, cfg1);
    addChrome(document, dom1, cfg1);
    const s1 = parseFloat(dom1.container.style.getPropertyValue("--fit-scale"));
    expect(s2).toBeCloseTo(s1 * 2, 5); // fit scales linearly with the user's scale setting
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

  it("caps radial maxWidth from R and grows toward the max font-size when space allows", () => {
    const dom = buildWheel(document, cfg);
    const textEl = dom.entries[0]!.querySelector<HTMLElement>(".entry-text")!;
    fitEntryText(textEl, 0.25, 200);
    expect(textEl.style.maxWidth).toBe(0.46 * 200 + "px");
    // jsdom reports scrollWidth/scrollHeight as 0 (no real text layout), so every candidate
    // size "fits" and the search converges to the max font-size cap.
    const fs = Number.parseFloat(textEl.style.fontSize);
    expect(fs).toBeGreaterThan(15);
    expect(fs).toBeLessThanOrEqual(44);
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
