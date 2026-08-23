import { describe, it, expect, vi } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import { buildWheel } from "../src/render/wheel.js";
import { createAnimator } from "../src/spin/animator.js";
import type { SpinResult } from "../src/model/spin.js";
import { layout, sliceAtAngle, sliceCenterDeg } from "../src/model/geometry.js";
import { deg, normalizeDeg } from "../src/model/units.js";

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

  it("ignores a spin request while already spinning", async () => {
    vi.useFakeTimers();
    const dom = buildWheel(document, cfg);
    let count = 0;
    const anim = createAnimator(dom, cfg, { onResult: () => count++ }, () => 0.1);
    anim.spin();
    anim.spin(); // second call while spinning must be a true no-op
    await vi.advanceTimersByTimeAsync(cfg.spinDurationSec * 1000 + 100);
    expect(count).toBe(1);
    vi.useRealTimers();
  });

  it("persists the rotation accumulator forward across sequential spins", async () => {
    vi.useFakeTimers();
    const dom = buildWheel(document, cfg);
    let count = 0;
    const anim = createAnimator(dom, cfg, { onResult: () => count++ }, () => 0.1);

    anim.spin();
    await vi.advanceTimersByTimeAsync(cfg.spinDurationSec * 1000 + 100);
    const r1 = parseFloat(dom.wheel.style.getPropertyValue("--spin-degree"));

    anim.spin();
    await vi.advanceTimersByTimeAsync(cfg.spinDurationSec * 1000 + 100);
    const r2 = parseFloat(dom.wheel.style.getPropertyValue("--spin-degree"));

    expect(r2).toBeGreaterThan(r1);
    expect(count).toBe(2);
    vi.useRealTimers();
  });

  it("magnetism on: settles with a slice center under the top pointer, not the raw angle", async () => {
    vi.useFakeTimers();
    const magnetCfg = (() => {
      const r = parseConfig({ sliceEntries: "A, B, C, D", spinDuration: 0.01, seamBand: 0, magnetism: true });
      if (r.kind !== "ok") throw new Error("bad");
      return r.value;
    })();
    const dom = buildWheel(document, magnetCfg);
    const rng = () => 0.37; // arbitrary seed: raw rest angle is not already a slice center
    const anim = createAnimator(dom, magnetCfg, { onResult: () => {} }, rng);
    anim.spin();
    await vi.advanceTimersByTimeAsync(magnetCfg.spinDurationSec * 1000 + 100);

    const finalRotation = parseFloat(dom.wheel.style.getPropertyValue("--spin-degree"));
    const pointerAngle = normalizeDeg(deg(90 - finalRotation));
    const laid = layout(magnetCfg.slices);
    const covered = sliceAtAngle(laid, deg(rng() * 360));
    const expectedCenter = sliceCenterDeg(laid.find((l) => l.index === covered)!);
    expect(pointerAngle as number).toBeCloseTo(expectedCenter as number, 5);
    vi.useRealTimers();
  });

  it("magnetism off: settles with the raw picked angle under the top pointer", async () => {
    vi.useFakeTimers();
    const dom = buildWheel(document, cfg); // cfg has magnetism false, seamBand 0
    const rng = () => 0.1; // raw rest angle = 0.1 * 360 = 36deg
    const anim = createAnimator(dom, cfg, { onResult: () => {} }, rng);
    anim.spin();
    await vi.advanceTimersByTimeAsync(cfg.spinDurationSec * 1000 + 100);

    const finalRotation = parseFloat(dom.wheel.style.getPropertyValue("--spin-degree"));
    const pointerAngle = normalizeDeg(deg(90 - finalRotation));
    expect(pointerAngle as number).toBeCloseTo(36, 5);
    vi.useRealTimers();
  });
});
