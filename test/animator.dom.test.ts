import { describe, it, expect, vi } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import { buildWheel } from "../src/render/wheel.js";
import { createAnimator } from "../src/spin/animator.js";
import type { SpinResult } from "../src/model/spin.js";

const cfg = (() => {
  const r = parseConfig({ sliceEntries: "A, B, C, D", spinDuration: 0.01, seamBand: 0 });
  if (r.kind !== "ok") throw new Error("bad");
  return r.value;
})();

describe("animator", () => {
  it("spins and reports a result, advancing the rotation forward", async () => {
    vi.useFakeTimers();
    const dom = buildWheel(document, cfg);
    let result: SpinResult | undefined;
    const rng = () => 0.1; // deterministic rest angle and spin count
    const anim = createAnimator(dom, cfg, { onResult: (r) => (result = r) }, rng);
    anim.spin();
    expect(anim.isSpinning()).toBe(true);
    const before = parseFloat(dom.wheel.style.getPropertyValue("--spin-degree"));
    expect(before).toBeGreaterThan(360 * 5);
    await vi.advanceTimersByTimeAsync(100);
    expect(anim.isSpinning()).toBe(false);
    expect(result).toBeDefined();
    expect(result!.kind === "winner" || result!.kind === "seam").toBe(true);
    vi.useRealTimers();
  });

  it("ignores a spin request while already spinning", () => {
    const dom = buildWheel(document, cfg);
    let count = 0;
    const anim = createAnimator(dom, cfg, { onResult: () => count++ }, () => 0.1);
    anim.spin();
    anim.spin();
    expect(anim.isSpinning()).toBe(true);
  });
});
