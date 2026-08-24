import { describe, it, expect } from "vitest";
import { combineLabels } from "../src/model/combine.js";

describe("combineLabels", () => {
  it("sums a currency amount and pluralizes a repeated name", () => {
    expect(combineLabels("$10 + Spin", "$20 + Spin")).toBe("$30 + 2 Spins");
  });

  it("counts a bare name as one and keeps 1 singular", () => {
    expect(combineLabels("Spin", "Spin")).toBe("2 Spins");
    expect(combineLabels("Spin", "$5")).toBe("Spin + $5");
  });

  it("adds explicit counts and matches by name case-insensitively", () => {
    expect(combineLabels("2 Spin", "3 spin")).toBe("5 Spins");
  });

  it("pluralizes irregular endings and only the last word", () => {
    expect(combineLabels("Box", "Box")).toBe("2 Boxes");
    expect(combineLabels("Free spin", "Free spin")).toBe("2 Free spins");
    expect(combineLabels("Story", "Story")).toBe("2 Stories");
  });

  it("sums matching currency prefixes and preserves order of first appearance", () => {
    expect(combineLabels("$10 + 100 pts", "$5 + 50 pts")).toBe("$15 + 150 pts");
  });

  it("keeps non-matching terms side by side", () => {
    expect(combineLabels("Pizza", "Tacos")).toBe("Pizza + Tacos");
  });

  it("handles decimals and trims float noise", () => {
    expect(combineLabels("$10.10", "$20.20")).toBe("$30.3");
  });
});
