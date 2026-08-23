import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import { buildWheel } from "../src/render/wheel.js";
import { addChrome } from "../src/render/chrome.js";

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
});
