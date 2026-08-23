import { describe, it, expect } from "vitest";
import { parseSliceList, resolveWeights } from "../src/config/slices.js";

const ok = (r: ReturnType<typeof parseSliceList>) => {
  if (r.kind !== "ok") throw new Error("expected ok, got " + JSON.stringify(r.errors));
  return r.value;
};

describe("parseSliceList", () => {
  it("parses unweighted entries as kind default with rawWeight 1", () => {
    const s = ok(parseSliceList("Apple, Banana"));
    expect(s.map((x) => x.text)).toEqual(["Apple", "Banana"]);
    expect(s.map((x) => x.kind)).toEqual(["default", "default"]);
    expect(s.map((x) => x.rawWeight)).toEqual([1, 1]);
    expect(s.map((x) => x.index as number)).toEqual([0, 1]);
  });
  it("parses [n] as relative and [n%] as percent", () => {
    const s = ok(parseSliceList("A [5], B [10%], C"));
    expect(s.map((x) => x.kind)).toEqual(["relative", "percent", "default"]);
    expect(s.map((x) => x.rawWeight)).toEqual([5, 10, 1]);
    expect(s.map((x) => x.text)).toEqual(["A", "B", "C"]);
  });
  it("errors on an empty list", () => {
    const r = parseSliceList("   ");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors[0]!.kind).toBe("empty-slice-list");
  });
  it("errors on a non-positive weight", () => {
    const r = parseSliceList("A [0], B [x]");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors.map((e) => e.kind)).toEqual(["bad-weight", "bad-weight"]);
  });
});

describe("resolveWeights: absolute mode (normalizeWeights=false)", () => {
  it("a single percent slice shares the wheel with the default remainder", () => {
    const entries = ok(parseSliceList("A, B [50%]"));
    const s = resolveWeights(entries, false);
    expect(s.map((x) => x.weight as number)).toEqual([50, 50]);
  });
  it("one percent slice claims its share; the rest split the remainder evenly", () => {
    const entries = ok(parseSliceList("A, B, C [80%]"));
    const s = resolveWeights(entries, false);
    expect(s[0]!.weight as number).toBeCloseTo(10);
    expect(s[1]!.weight as number).toBeCloseTo(10);
    expect(s[2]!.weight as number).toBeCloseTo(80);
  });
  it("relative-only entries (no %) split proportionally with no percent involved", () => {
    const entries = ok(parseSliceList("A [3], B"));
    const s = resolveWeights(entries, false);
    expect(s[0]!.weight as number).toBeCloseTo(75);
    expect(s[1]!.weight as number).toBeCloseTo(25);
  });
  it("percents scale down proportionally when they sum past 100", () => {
    const entries = ok(parseSliceList("A [60%], B [90%]"));
    const s = resolveWeights(entries, false);
    expect((s[0]!.weight as number) + (s[1]!.weight as number)).toBeCloseTo(100);
    expect((s[0]!.weight as number) / (s[1]!.weight as number)).toBeCloseTo(60 / 90);
  });
  it("percent-only entries under 100 normalize among themselves to avoid a gap", () => {
    const entries = ok(parseSliceList("A [30%], B [20%]"));
    const s = resolveWeights(entries, false);
    expect(s[0]!.weight as number).toBeCloseTo(60);
    expect(s[1]!.weight as number).toBeCloseTo(40);
  });
});

describe("resolveWeights: compat mode (normalizeWeights=true)", () => {
  it("treats [n] and [n%] identically as relative weights normalized to the total", () => {
    const entries = ok(parseSliceList("A [5], B [10%], C"));
    const s = resolveWeights(entries, true);
    expect(s.map((x) => x.weight as number)).toEqual([5, 10, 1]);
  });
});
