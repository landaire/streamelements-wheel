import { describe, it, expect } from "vitest";
import { parseAdvancedConfig, resolveAdvancedWeights, withExtraItems, type AdvancedConfig } from "../src/config/advanced.js";

const ok = (r: ReturnType<typeof parseAdvancedConfig>): AdvancedConfig => {
  if (r.kind !== "ok") throw new Error("expected ok, got " + JSON.stringify(r.errors));
  return r.value;
};

// Compares proportions rather than absolute weights: resolveAdvancedWeights hands raw
// products to geometry, which renormalizes, so only relative shares matter.
function proportions(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
}

describe("parseAdvancedConfig", () => {
  it("parses a well-formed config", () => {
    const cfg = ok(parseAdvancedConfig(JSON.stringify({ categories: [{ id: "a", name: "A", weight: 1 }], items: [{ text: "x", weight: 1, categoryId: "a" }] })));
    expect(cfg.categories).toEqual([{ id: "a", name: "A", weight: 1 }]);
    expect(cfg.items).toEqual([{ text: "x", weight: 1, categoryId: "a" }]);
  });

  it("errors on malformed JSON", () => {
    const r = parseAdvancedConfig("{not json");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors[0]!.kind).toBe("bad-advanced-json");
  });

  it("errors when categories/items are missing or not arrays", () => {
    const r = parseAdvancedConfig(JSON.stringify({ categories: "nope", items: [] }));
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors[0]!.kind).toBe("bad-advanced-json");
  });

  it("errors on a malformed category or item entry", () => {
    const r = parseAdvancedConfig(JSON.stringify({ categories: [{ id: "a" }], items: [{ text: "x", weight: 1 }] }));
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors.some((e) => e.kind === "bad-advanced-json")).toBe(true);
  });

  it("errors with empty-advanced when items is an empty array", () => {
    const r = parseAdvancedConfig(JSON.stringify({ categories: [], items: [] }));
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors[0]!.kind).toBe("empty-advanced");
  });
});

describe("resolveAdvancedWeights", () => {
  it("two categories (7/3) x two equal-weight items -> proportional to [0.35, 0.35, 0.15, 0.15]", () => {
    const cfg: AdvancedConfig = {
      categories: [
        { id: "big", name: "Big", weight: 7 },
        { id: "small", name: "Small", weight: 3 },
      ],
      items: [
        { text: "big1", weight: 1, categoryId: "big" },
        { text: "big2", weight: 1, categoryId: "big" },
        { text: "small1", weight: 1, categoryId: "small" },
        { text: "small2", weight: 1, categoryId: "small" },
      ],
    };
    const slices = resolveAdvancedWeights(cfg);
    const p = proportions(slices.map((s) => s.weight as number));
    expect(p[0]).toBeCloseTo(0.35);
    expect(p[1]).toBeCloseTo(0.35);
    expect(p[2]).toBeCloseTo(0.15);
    expect(p[3]).toBeCloseTo(0.15);
  });

  it("80/10/10 categories, single item each -> matching proportions", () => {
    const cfg: AdvancedConfig = {
      categories: [
        { id: "a", name: "A", weight: 80 },
        { id: "b", name: "B", weight: 10 },
        { id: "c", name: "C", weight: 10 },
      ],
      items: [
        { text: "x", weight: 1, categoryId: "a" },
        { text: "y", weight: 1, categoryId: "b" },
        { text: "z", weight: 1, categoryId: "c" },
      ],
    };
    const p = proportions(resolveAdvancedWeights(cfg).map((s) => s.weight as number));
    expect(p).toEqual([expect.closeTo(0.8, 5), expect.closeTo(0.1, 5), expect.closeTo(0.1, 5)]);
  });

  it("splits unevenly within a category by item weight", () => {
    const cfg: AdvancedConfig = {
      categories: [{ id: "a", name: "A", weight: 1 }],
      items: [
        { text: "x", weight: 3, categoryId: "a" },
        { text: "y", weight: 1, categoryId: "a" },
      ],
    };
    const p = proportions(resolveAdvancedWeights(cfg).map((s) => s.weight as number));
    expect(p[0]).toBeCloseTo(0.75);
    expect(p[1]).toBeCloseTo(0.25);
  });

  it("items with no categoryId, or an unmatched categoryId, land in Uncategorized", () => {
    const cfg: AdvancedConfig = {
      categories: [{ id: "a", name: "A", weight: 1 }],
      items: [
        { text: "cat-item", weight: 1, categoryId: "a" },
        { text: "no-cat", weight: 1 },
        { text: "bad-cat", weight: 1, categoryId: "does-not-exist" },
      ],
    };
    const slices = resolveAdvancedWeights(cfg);
    expect(slices.map((s) => s.text)).toEqual(["cat-item", "no-cat", "bad-cat"]);
    // Uncategorized items get no color and still carry a positive weight.
    expect(slices[1]!.color).toBeUndefined();
    expect(slices[2]!.color).toBeUndefined();
    expect(slices[1]!.weight as number).toBeGreaterThan(0);
  });

  it("a user category id that spells the reserved sentinel string is treated as a real category, not merged into Uncategorized", () => {
    const cfg: AdvancedConfig = {
      categories: [{ id: "uncategorized", name: "Weird", weight: 5, color: "#123456" }],
      items: [{ text: "x", weight: 1, categoryId: "uncategorized" }],
    };
    const slices = resolveAdvancedWeights(cfg);
    // The category's own weight/color must win -- not silently overridden by the
    // synthetic Uncategorized group's averaged weight and undefined color.
    expect(slices[0]!.color).toBe("#123456");
  });

  it("an empty category (defined but with no items) contributes nothing", () => {
    const cfg: AdvancedConfig = {
      categories: [
        { id: "full", name: "Full", weight: 1 },
        { id: "empty", name: "Empty", weight: 999 },
      ],
      items: [{ text: "only", weight: 1, categoryId: "full" }],
    };
    const slices = resolveAdvancedWeights(cfg);
    expect(slices.map((s) => s.text)).toEqual(["only"]);
  });

  it("a zero-or-negative-weight category still renders its items as a thin sliver, not vanished", () => {
    const cfg: AdvancedConfig = {
      categories: [
        { id: "a", name: "A", weight: 1 },
        { id: "b", name: "B", weight: -5 },
      ],
      items: [
        { text: "x", weight: 1, categoryId: "a" },
        { text: "y", weight: 1, categoryId: "b" },
      ],
    };
    const slices = resolveAdvancedWeights(cfg);
    expect(slices[1]!.weight as number).toBeGreaterThan(0);
    expect(slices[1]!.weight as number).toBeLessThan(slices[0]!.weight as number);
  });

  it("category color propagates to each of its items' Slice.color", () => {
    const cfg: AdvancedConfig = {
      categories: [{ id: "a", name: "A", weight: 1, color: "#ff0000" }],
      items: [
        { text: "x", weight: 1, categoryId: "a" },
        { text: "y", weight: 1, categoryId: "a" },
      ],
    };
    const slices = resolveAdvancedWeights(cfg);
    expect(slices[0]!.color).toBe("#ff0000");
    expect(slices[1]!.color).toBe("#ff0000");
  });

  it("a category with no color leaves Slice.color undefined", () => {
    const cfg: AdvancedConfig = { categories: [{ id: "a", name: "A", weight: 1 }], items: [{ text: "x", weight: 1, categoryId: "a" }] };
    expect(resolveAdvancedWeights(cfg)[0]!.color).toBeUndefined();
  });
});

describe("withExtraItems", () => {
  it("appends extras as Uncategorized items, weight 1", () => {
    const cfg: AdvancedConfig = { categories: [{ id: "a", name: "A", weight: 1 }], items: [{ text: "x", weight: 1, categoryId: "a" }] };
    const withExtras = withExtraItems(cfg, ["Pizza", "Tacos"]);
    expect(withExtras.items.map((i) => i.text)).toEqual(["x", "Pizza", "Tacos"]);
    expect(withExtras.items[1]!.categoryId).toBeUndefined();
  });

  it("returns the same config when there are no extras", () => {
    const cfg: AdvancedConfig = { categories: [], items: [{ text: "x", weight: 1 }] };
    expect(withExtraItems(cfg, [])).toBe(cfg);
  });
});
