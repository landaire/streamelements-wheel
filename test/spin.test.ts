import { describe, it, expect } from "vitest";
import { deg, weight, sliceIndex, normalizeDeg } from "../src/model/units.js";
import { layout } from "../src/model/geometry.js";
import { resolveLanding, nextRotation, pickRestAngle } from "../src/model/spin.js";
import type { Slice } from "../src/config/slices.js";

const mk = (weights: number[]): Slice[] =>
  weights.map((w, i) => ({ index: sliceIndex(i), text: String(i), weight: weight(w) }));

describe("spin resolution", () => {
  const l = layout(mk([1, 1, 1, 1])); // 4 equal slices, seams at 0/90/180/270

  it("magnetism off: a clear angle yields the covering slice at the raw angle", () => {
    const r = resolveLanding(l, deg(45), { magnetism: false, seamBandDeg: deg(3) });
    expect(r.kind).toBe("winner");
    if (r.kind === "winner") {
      expect(r.slice as number).toBe(0);
      expect(r.restAngle as number).toBeCloseTo(45);
    }
  });

  it("magnetism off: an angle inside the seam band yields no winner", () => {
    const r = resolveLanding(l, deg(89), { magnetism: false, seamBandDeg: deg(3) });
    expect(r.kind).toBe("seam");
    if (r.kind === "seam") expect(r.between.map((x) => x as number)).toEqual([0, 1]);
  });

  it("magnetism on: snaps to the covering slice center", () => {
    const r = resolveLanding(l, deg(89), { magnetism: true, seamBandDeg: deg(3) });
    expect(r.kind).toBe("winner");
    if (r.kind === "winner") {
      expect(r.slice as number).toBe(0);
      expect(r.restAngle as number).toBeCloseTo(45);
    }
  });

  it("uniform angles land in slices proportional to weight", () => {
    const wl = layout(mk([3, 1])); // slice 0 = 270deg arc, slice 1 = 90deg arc
    let counts = [0, 0];
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const a = deg(((i + 0.5) / N) * 360); // deterministic uniform sweep
      const r = resolveLanding(wl, a, { magnetism: false, seamBandDeg: deg(0) });
      if (r.kind === "winner") counts[r.slice as number]!++;
    }
    expect(counts[0]! / N).toBeCloseTo(0.75, 1);
    expect(counts[1]! / N).toBeCloseTo(0.25, 1);
  });

  it("nextRotation lands the pointer on the requested rest angle, always forward", () => {
    const target = deg(45);
    const R = nextRotation(0, target, 5);
    expect(R).toBeGreaterThan(0);
    expect(normalizeDeg(deg(90 - R)) as number).toBeCloseTo(45);
    expect(R).toBeGreaterThanOrEqual(5 * 360); // at least the requested full turns
  });

  it("pickRestAngle stays in [0,360)", () => {
    const a = pickRestAngle(() => 0.9999) as number;
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });

  it("small slice is never winnable when 2*seamBandDeg >= slice arc", () => {
    // weights [1, 20]: slice 0 arc = 360*1/21 ~= 17.14 deg; slice 1 arc ~= 342.86 deg
    // with seamBandDeg deg(12), 2*band = 24 > 17.14, so slice 0 is fully consumed by seams
    const wl = layout(mk([1, 20]));
    const seamBand = deg(12);
    let hasWinner0 = false;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const a = deg(((i + 0.5) / N) * 360);
      const r = resolveLanding(wl, a, { magnetism: false, seamBandDeg: seamBand });
      if (r.kind === "winner" && (r.slice as number) === 0) hasWinner0 = true;
    }
    expect(hasWinner0).toBe(false);
  });

  it("small slice can win when seamBandDeg is 0", () => {
    // Same weights [1, 20] but with no seam band, slice 0 should win in its arc range
    const wl = layout(mk([1, 20]));
    let hasWinner0 = false;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const a = deg(((i + 0.5) / N) * 360);
      const r = resolveLanding(wl, a, { magnetism: false, seamBandDeg: deg(0) });
      if (r.kind === "winner" && (r.slice as number) === 0) hasWinner0 = true;
    }
    expect(hasWinner0).toBe(true);
  });
});
