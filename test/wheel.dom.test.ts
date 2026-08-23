import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import { buildWheel } from "../src/render/wheel.js";

const cfg = (() => {
  const r = parseConfig({ sliceEntries: "A, B, C, D, E, F, G, H, I, J, K, L, M" }); // 13 > 24-cap edge
  if (r.kind !== "ok") throw new Error("bad cfg");
  return r.value;
})();

describe("buildWheel", () => {
  it("creates one slice and entry per config slice with layout vars", () => {
    const dom = buildWheel(document, cfg);
    expect(dom.slices.length).toBe(13);
    expect(dom.entries.length).toBe(13);
    const first = dom.slices[0]!;
    expect(first.style.getPropertyValue("--slice-start").trim()).toBe("0turn");
    expect(first.style.getPropertyValue("--slice-size").trim()).not.toBe("");
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
});
