import { describe, it, expect } from "vitest";
import { parseSliceList } from "../src/config/slices.js";

const ok = (r: ReturnType<typeof parseSliceList>) => {
  if (r.kind !== "ok") throw new Error("expected ok, got " + JSON.stringify(r.errors));
  return r.value;
};

describe("parseSliceList", () => {
  it("parses unweighted entries with default weight 1", () => {
    const s = ok(parseSliceList("Apple, Banana"));
    expect(s.map((x) => x.text)).toEqual(["Apple", "Banana"]);
    expect(s.map((x) => x.weight as number)).toEqual([1, 1]);
    expect(s.map((x) => x.index as number)).toEqual([0, 1]);
  });
  it("parses [n] and [n%] as weights", () => {
    const s = ok(parseSliceList("A [5], B [10%], C"));
    expect(s.map((x) => x.weight as number)).toEqual([5, 10, 1]);
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
