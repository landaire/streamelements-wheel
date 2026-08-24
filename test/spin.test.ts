import { describe, it, expect } from "vitest";
import { deg, weight, sliceIndex, normalizeDeg } from "../src/model/units.js";
import { layout } from "../src/model/geometry.js";
import {
  resolveLanding,
  nextRotation,
  pickRestAngle,
  pickForce,
  spinTurns,
  forceBucket,
  FORCE_BUCKETS,
  SPIN_TURNS_MIN,
  SPIN_TURNS_MAX,
} from "../src/model/spin.js";
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

  it("magnetism off: an angle inside the seam band yields a seam result, resting where it landed by default", () => {
    const r = resolveLanding(l, deg(89), { magnetism: false, seamBandDeg: deg(3) });
    expect(r.kind).toBe("seam");
    if (r.kind === "seam") {
      expect(r.between.map((x) => x as number)).toEqual([0, 1]);
      expect(r.restAngle as number).toBeCloseTo(89); // natural stop, not snapped to the 90 boundary
    }
  });

  it("magnetism off: seamSnap glides the seam landing onto the exact boundary", () => {
    const r = resolveLanding(l, deg(89), { magnetism: false, seamBandDeg: deg(3), seamSnap: true });
    expect(r.kind).toBe("seam");
    if (r.kind === "seam") {
      expect(r.between.map((x) => x as number)).toEqual([0, 1]);
      expect(r.restAngle as number).toBeCloseTo(90); // snapped onto the divider
    }
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

  it("thin slice keeps a winnable center even when the configured band would swallow it", () => {
    // weights [1, 20]: slice 0 arc = 360*1/21 ~= 17.14 deg. A raw band of 12 deg would eat
    // 2*12 = 24 > 17.14 and leave nothing, but the per-seam band is clamped to a fraction of
    // the neighbouring arc, so slice 0 still wins across its center.
    const wl = layout(mk([1, 20]));
    let hasWinner0 = false;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const a = deg(((i + 0.5) / N) * 360);
      const r = resolveLanding(wl, a, { magnetism: false, seamBandDeg: deg(12) });
      if (r.kind === "winner" && (r.slice as number) === 0) hasWinner0 = true;
    }
    expect(hasWinner0).toBe(true);
  });

  it("pickForce: variance 0 is always neutral 0.5", () => {
    for (const r of [0, 0.5, 0.999]) {
      expect(pickForce(() => r, 0) as number).toBeCloseTo(0.5);
    }
  });

  it("pickForce: variance spreads force around 0.5 within [0,1]", () => {
    expect(pickForce(() => 0, 1) as number).toBeCloseTo(0); // 0.5 + (0-0.5)*1
    expect(pickForce(() => 1, 1) as number).toBeCloseTo(1); // 0.5 + (1-0.5)*1
    // partial variance narrows the spread
    expect(pickForce(() => 0, 0.6) as number).toBeCloseTo(0.2);
    expect(pickForce(() => 1, 0.6) as number).toBeCloseTo(0.8);
  });

  it("spinTurns: rises with force, stays an integer inside the configured range", () => {
    const lo = spinTurns(pickForce(() => 0, 1));
    const hi = spinTurns(pickForce(() => 1, 1));
    expect(lo).toBe(SPIN_TURNS_MIN);
    expect(hi).toBe(SPIN_TURNS_MAX);
    expect(Number.isInteger(lo) && Number.isInteger(hi)).toBe(true);
    expect(hi).toBeGreaterThan(lo);
    // nextRotation still lands exactly on target with these whole-turn counts
    for (const turns of [lo, hi]) {
      const R = nextRotation(0, deg(45), turns);
      expect(normalizeDeg(deg(90 - R)) as number).toBeCloseTo(45);
    }
  });

  it("forceBucket: monotonic, spans 0..FORCE_BUCKETS-1, and each bucket names a defined keyframe", () => {
    expect(forceBucket(pickForce(() => 0, 1))).toBe(0); // force 0 -> calmest curve
    expect(forceBucket(pickForce(() => 1, 1))).toBe(FORCE_BUCKETS - 1); // force 1 -> most suspenseful
    expect(forceBucket(pickForce(() => 0.5, 1))).toBe(Math.round(0.5 * (FORCE_BUCKETS - 1)));
    // monotonic non-decreasing across the force range
    let prev = -1;
    for (let i = 0; i <= 10; i++) {
      const b = forceBucket(pickForce(() => i / 10, 1));
      expect(b).toBeGreaterThanOrEqual(prev);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(FORCE_BUCKETS);
      prev = b;
    }
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
