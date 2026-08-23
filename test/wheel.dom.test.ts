import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import { buildWheel } from "../src/render/wheel.js";
import { addChrome } from "../src/render/chrome.js";
import { layout, sliceAtAngle } from "../src/model/geometry.js";
import { deg } from "../src/model/units.js";

const cfg = (() => {
  const r = parseConfig({ sliceEntries: "A, B, C, D, E, F, G, H, I, J, K, L, M" }); // 13 > 24-cap edge
  if (r.kind !== "ok") throw new Error("bad cfg");
  return r.value;
})();

describe("buildWheel", () => {
  it("creates one slice path and one entry per config slice", () => {
    const dom = buildWheel(document, cfg);
    expect(dom.slices.length).toBe(13);
    expect(dom.entries.length).toBe(13);
    expect(dom.wheel.querySelectorAll("path.slice").length).toBe(13);
    for (const path of dom.slices) expect(path.tagName.toLowerCase()).toBe("path");
  });

  it("sets the wheel rotation via a CSS custom property", () => {
    const dom = buildWheel(document, cfg);
    dom.setRotation(123.5);
    expect(dom.wheel.style.getPropertyValue("--spin-degree").trim()).toBe("123.5deg");
  });

  it("labels each entry with its text", () => {
    const dom = buildWheel(document, cfg);
    expect(dom.entries[1]!.textContent).toContain("B");
  });

  it("gives darker (even) slices a stroke and leaves odd slices without one", () => {
    const dom = buildWheel(document, cfg);
    dom.slices.forEach((path, i) => {
      if (i % 2 === 0) {
        expect(path.classList.contains("slice-even")).toBe(true);
        expect(path.style.stroke).not.toBe("");
      } else {
        expect(path.classList.contains("slice-odd")).toBe(true);
        expect(path.style.stroke).toBe("");
      }
    });
  });

  it("draws each wedge path starting at the disc center", () => {
    const dom = buildWheel(document, cfg);
    for (const path of dom.slices) {
      expect(path.getAttribute("d")).toMatch(/^M 250 250 L /);
    }
  });

  it("the wedge covering screen-top matches sliceAtAngle for an equal 4-slice layout", () => {
    const r = parseConfig({ sliceEntries: "A, B, C, D" });
    if (r.kind !== "ok") throw new Error("bad");
    const laid = layout(r.value.slices);
    const expectedIndex = sliceAtAngle(laid, deg(90)) as number;

    const dom = buildWheel(document, r.value);
    // beta=0 (screen top) -> a=90; top point is (250, 250-244) = (250, 6).
    const topPath = dom.slices[expectedIndex]!;
    const d = topPath.getAttribute("d")!;
    const nums = d.match(/-?[0-9]+(\.[0-9]+)?/g)!.map(Number);
    // d = M cx cy L x0 y0 A rx ry rot largeArc sweep x1 y1
    const [, , x0, y0, , , , , , x1, y1] = nums;
    const nearTop = (x: number, y: number): boolean => Math.abs(x - 250) < 1 && Math.abs(y - 6) < 1;
    expect(nearTop(x0!, y0!) || nearTop(x1!, y1!)).toBe(true);
  });
});

describe("hub rendering", () => {
  it("renders hubMode image as an <img>", () => {
    const r = parseConfig({
      sliceEntries: "A, B",
      hubMode: "image",
      hubImage: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    });
    if (r.kind !== "ok") throw new Error("bad");
    const dom = buildWheel(document, r.value);
    addChrome(document, dom, r.value);
    const img = dom.container.querySelector<HTMLImageElement>(".centerpiece img.hub-image");
    expect(img).not.toBeNull();
    expect(img!.src).toContain("data:image/gif");
  });

  it("renders hubMode text/fit with hubText content", () => {
    const r = parseConfig({ sliceEntries: "A, B", hubMode: "text", hubTextStyle: "fit", hubText: "SPIN\nTHE\nWHEEL" });
    if (r.kind !== "ok") throw new Error("bad");
    const dom = buildWheel(document, r.value);
    addChrome(document, dom, r.value);
    const textEl = dom.container.querySelector(".centerpiece .hub-text-fit");
    expect(textEl).not.toBeNull();
    expect(textEl!.textContent).toBe("SPIN\nTHE\nWHEEL");
  });

  it("renders hubMode text/curve with a textPath carrying hubText", () => {
    const r = parseConfig({ sliceEntries: "A, B", hubMode: "text", hubTextStyle: "curve", hubText: "SPIN THE WHEEL" });
    if (r.kind !== "ok") throw new Error("bad");
    const dom = buildWheel(document, r.value);
    addChrome(document, dom, r.value);
    const textPath = dom.container.querySelector("textPath");
    expect(textPath).not.toBeNull();
    expect(textPath!.textContent).toBe("SPIN THE WHEEL");
  });

  it("defaults to an icon glyph for hubMode icon", () => {
    const r = parseConfig({ sliceEntries: "A, B", centerIcon: "heart" });
    if (r.kind !== "ok") throw new Error("bad");
    const dom = buildWheel(document, r.value);
    addChrome(document, dom, r.value);
    expect(dom.container.querySelector(".centerpiece .center-icon.cb-heart")).not.toBeNull();
  });
});
