import { describe, it, expect } from "vitest";
import { deg, weight, sliceIndex } from "../src/model/units.js";
import { layout, sliceCenterDeg, sliceAtAngle, nearestSeam, effectiveSeamBandDeg, MAX_SEAM_FRACTION } from "../src/model/geometry.js";
import type { Slice } from "../src/config/slices.js";

const mk = (weights: number[]): Slice[] =>
  weights.map((w, i) => ({ index: sliceIndex(i), text: String(i), weight: weight(w) }));

describe("geometry", () => {
  it("lays out arcs proportional to weight, summing to 1", () => {
    const l = layout(mk([1, 3]));
    expect(l[0]!.sizeTurn as number).toBeCloseTo(0.25);
    expect(l[1]!.sizeTurn as number).toBeCloseTo(0.75);
    expect((l[0]!.startTurn as number)).toBeCloseTo(0);
    expect((l[1]!.startTurn as number)).toBeCloseTo(0.25);
  });
  it("computes slice centers in degrees", () => {
    const l = layout(mk([1, 1, 1, 1]));
    expect(sliceCenterDeg(l[0]!) as number).toBeCloseTo(45);
    expect(sliceCenterDeg(l[1]!) as number).toBeCloseTo(135);
  });
  it("maps an angle to the covering slice", () => {
    const l = layout(mk([1, 1, 1, 1]));
    expect(sliceAtAngle(l, deg(10)) as number).toBe(0);
    expect(sliceAtAngle(l, deg(100)) as number).toBe(1);
    expect(sliceAtAngle(l, deg(359)) as number).toBe(3);
  });
  it("finds the nearest seam and the two slices it divides", () => {
    const l = layout(mk([1, 1, 1, 1])); // seams at 0,90,180,270
    const s = nearestSeam(l, deg(88));
    expect(s.dist as number).toBeCloseTo(2);
    expect(s.between.map((x) => x as number)).toEqual([0, 1]);
  });
  it("finds nearest seam at the 0/360 wraparound boundary", () => {
    const l = layout(mk([1, 1, 1, 1])); // seams at 0,90,180,270
    const s = nearestSeam(l, deg(2));
    expect(s.dist as number).toBeCloseTo(2);
    expect(s.between.map((x) => x as number)).toEqual([3, 0]);
    const s2 = nearestSeam(l, deg(358));
    expect(s2.dist as number).toBeCloseTo(2);
    expect(s2.between.map((x) => x as number)).toEqual([3, 0]);
  });
  it("nearestSeam reports the adjacent slice arcs", () => {
    const l = layout(mk([1, 20])); // slice 0 tiny, slice 1 large
    const s = nearestSeam(l, deg(0)); // seam at 0 between slice 1 and slice 0
    expect(s.prevSizeTurn as number).toBeCloseTo(20 / 21);
    expect(s.nextSizeTurn as number).toBeCloseTo(1 / 21);
  });
  it("effectiveSeamBandDeg passes the configured band through on roomy slices", () => {
    const l = layout(mk([1, 1, 1, 1])); // 90-deg arcs; 0.35*90 = 31.5 > 5
    const s = nearestSeam(l, deg(2));
    expect(effectiveSeamBandDeg(s.prevSizeTurn, s.nextSizeTurn, 5)).toBeCloseTo(5);
  });
  it("effectiveSeamBandDeg clamps to a fraction of the smaller neighbour on thin slices", () => {
    const l = layout(mk([1, 20]));
    const s = nearestSeam(l, deg(0));
    const arc0 = 360 / 21;
    expect(effectiveSeamBandDeg(s.prevSizeTurn, s.nextSizeTurn, 100)).toBeCloseTo(MAX_SEAM_FRACTION * arc0, 5);
  });
});
