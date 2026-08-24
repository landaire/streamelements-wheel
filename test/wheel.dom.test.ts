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

  it("tags slices even/odd and never strokes a wedge path (borders are separate seam lines)", () => {
    const dom = buildWheel(document, cfg);
    dom.slices.forEach((path, i) => {
      if (i % 2 === 0) expect(path.classList.contains("slice-even")).toBe(true);
      else expect(path.classList.contains("slice-odd")).toBe(true);
      expect(path.style.stroke).toBe("");
    });
  });

  it("draws exactly one divider line per slice boundary (no doubled borders)", () => {
    const dom = buildWheel(document, cfg);
    const svg = dom.wheel.querySelector(".wheel-svg")!;
    const lines = svg.querySelectorAll("line");
    // one radial divider per seam == one per slice
    expect(lines.length).toBe(dom.slices.length);
    lines.forEach((line) => {
      expect(line.getAttribute("x1")).toBe("250");
      expect(line.getAttribute("y1")).toBe("250");
      expect(line.style.stroke).not.toBe("");
    });
  });

  it("omits seam-zone overlays by default and draws one per seam when showSeamZone is on", () => {
    const off = buildWheel(document, cfg);
    expect(off.wheel.querySelectorAll("path.seam-zone").length).toBe(0);

    const r = parseConfig({ sliceEntries: "A, B, C, D", showSeamZone: true });
    if (r.kind !== "ok") throw new Error("bad");
    const on = buildWheel(document, r.value);
    const zones = on.wheel.querySelectorAll("path.seam-zone");
    expect(zones.length).toBe(4);
    zones.forEach((z) => expect(z.getAttribute("d")).toMatch(/^M 250 250 L /));
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

describe("buildWheel: category colors", () => {
  it("uses each slice's color as its fill when advancedConfig sets one", () => {
    const advanced = JSON.stringify({
      categories: [
        { id: "red", name: "Red", weight: 1, color: "#ff0000" },
        { id: "blue", name: "Blue", weight: 1, color: "#0000ff" },
      ],
      items: [
        { text: "r", weight: 1, categoryId: "red" },
        { text: "b", weight: 1, categoryId: "blue" },
      ],
    });
    const r = parseConfig({ sliceEntries: "unused", advancedConfig: advanced });
    if (r.kind !== "ok") throw new Error("bad cfg");
    const dom = buildWheel(document, r.value);
    const fills = dom.slices.map((s) => s.getAttribute("fill"));
    expect(fills).toContain("#ff0000");
    expect(fills).toContain("#0000ff");
  });

  it("leaves the alternating var(--slice-bg-*) fill for slices without a color (sliceEntries path)", () => {
    const dom = buildWheel(document, cfg);
    expect(dom.slices[0]!.getAttribute("fill")).toBe("var(--slice-bg-even)");
    expect(dom.slices[1]!.getAttribute("fill")).toBe("var(--slice-bg-odd)");
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
