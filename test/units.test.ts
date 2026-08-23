import { describe, it, expect } from "vitest";
import { deg, turns, weight, sliceIndex, normalizeDeg, turnsToDeg } from "../src/model/units.js";

describe("units", () => {
  it("normalizes degrees into [0,360)", () => {
    expect(normalizeDeg(deg(-90)) as number).toBe(270);
    expect(normalizeDeg(deg(450)) as number).toBe(90);
    expect(normalizeDeg(deg(360)) as number).toBe(0);
  });
  it("converts turns to degrees", () => {
    expect(turnsToDeg(turns(0.25)) as number).toBe(90);
  });
  it("rejects non-positive or non-finite weights", () => {
    expect(() => weight(0)).toThrow(RangeError);
    expect(() => weight(-1)).toThrow(RangeError);
    expect(() => weight(Infinity)).toThrow(RangeError);
    expect(weight(2.5) as number).toBe(2.5);
  });
  it("rejects non-integer or negative slice indices", () => {
    expect(() => sliceIndex(-1)).toThrow(RangeError);
    expect(() => sliceIndex(1.5)).toThrow(RangeError);
    expect(sliceIndex(0) as number).toBe(0);
  });
});
