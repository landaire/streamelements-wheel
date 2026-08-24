import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config/parse.js";
import type { FieldData } from "../src/se/types.js";

const base: FieldData = { sliceEntries: "A, B [3]" };

describe("parseConfig", () => {
  it("parses a minimal valid config with schema defaults", () => {
    const r = parseConfig({ ...base });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.slices.map((s) => s.text)).toEqual(["A", "B"]);
      expect(r.value.magnetism).toBe(false);
      expect(r.value.seamBandDeg as number).toBe(1);
      expect(r.value.style).toBe("fullwheel");
      expect(r.value.winSound).toBeUndefined();
    }
  });
  it("maps an explicit magnetism + seamBand", () => {
    const r = parseConfig({ ...base, magnetism: true, seamBand: 5 });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.magnetism).toBe(true);
      expect(r.value.seamBandDeg as number).toBe(5);
    }
  });
  it("defaults per-sound volumes to full (1) and maps percentages to 0..1", () => {
    const d = parseConfig({ ...base });
    expect(d.kind).toBe("ok");
    if (d.kind === "ok") {
      expect(d.value.winVolume).toBe(1);
      expect(d.value.tickVolume).toBe(1);
      expect(d.value.seamVolume).toBe(1);
    }
    const r = parseConfig({ ...base, volumeWin: 50, volumeTick: 0, volumeSeam: 200 });
    if (r.kind === "ok") {
      expect(r.value.winVolume).toBeCloseTo(0.5);
      expect(r.value.tickVolume).toBe(0);
      expect(r.value.seamVolume).toBe(1); // clamped
    }
  });
  it("defaults hub image framing and clamps zoom/offset", () => {
    const d = parseConfig({ ...base });
    if (d.kind === "ok") {
      expect(d.value.hubImageFill).toBe(true);
      expect(d.value.hubImageZoom).toBe(1);
      expect(d.value.hubImageOffsetX).toBe(50);
      expect(d.value.hubImageOffsetY).toBe(50);
    }
    const r = parseConfig({ ...base, hubImageFill: false, hubImageUnlocked: true, hubImageZoom: 250, hubImageOffsetX: -20, hubImageOffsetY: 140 });
    if (r.kind === "ok") {
      expect(r.value.hubImageFill).toBe(false);
      expect(r.value.hubImageUnlocked).toBe(true);
      expect(r.value.hubImageZoom).toBeCloseTo(2.5);
      // Free-placement range is wide (-200..300); locked render clamps to 0..100 at draw time.
      expect(r.value.hubImageOffsetX).toBe(-20);
      expect(r.value.hubImageOffsetY).toBe(140);
    }
    const clamp = parseConfig({ ...base, hubImageOffsetX: -999, hubImageOffsetY: 9999 });
    if (clamp.kind === "ok") {
      expect(clamp.value.hubImageOffsetX).toBe(-200);
      expect(clamp.value.hubImageOffsetY).toBe(300);
    }
  });
  it("empty sound field becomes undefined, not empty string", () => {
    const r = parseConfig({ ...base, soundWin: "" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.winSound).toBeUndefined();
  });
  it("falls back to the default slice list when sliceEntries is missing (back-compat)", () => {
    const r = parseConfig({});
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.slices.length).toBeGreaterThan(0);
  });
  it("falls back to the default slice list when sliceEntries is a non-string", () => {
    const r = parseConfig({ sliceEntries: 5 });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.slices.length).toBeGreaterThan(0);
  });
  it("coerces a stringified numeric field instead of dropping it", () => {
    const r = parseConfig({ sliceEntries: "A, B", spinDuration: "7" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.spinDurationSec).toBe(7);
  });
  it("defaults spinCommand to !spin", () => {
    const r = parseConfig({ ...base });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.spinCommand).toBe("!spin");
  });
  it("defaults the hub to icon mode with empty image/text", () => {
    const r = parseConfig({ ...base });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.hubMode).toBe("icon");
      expect(r.value.hubImage).toBe("");
      expect(r.value.hubText).toBe("");
      expect(r.value.hubTextStyle).toBe("fit");
    }
  });
  it("parses explicit hub fields", () => {
    const r = parseConfig({
      ...base,
      hubMode: "text",
      hubText: "SPIN\nTHE\nWHEEL",
      hubTextStyle: "curve",
      hubImage: "https://example.com/x.png",
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.hubMode).toBe("text");
      expect(r.value.hubText).toBe("SPIN\nTHE\nWHEEL");
      expect(r.value.hubTextStyle).toBe("curve");
      expect(r.value.hubImage).toBe("https://example.com/x.png");
    }
  });
  it("falls back to defaults for an unrecognized hubMode/hubTextStyle", () => {
    const r = parseConfig({ ...base, hubMode: "bogus", hubTextStyle: "bogus" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.hubMode).toBe("icon");
      expect(r.value.hubTextStyle).toBe("fit");
    }
  });
  it("defaults disableSound and disableTickSound to false", () => {
    const r = parseConfig({ ...base });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.disableSound).toBe(false);
      expect(r.value.disableTickSound).toBe(false);
    }
  });
  it("maps explicit disableSound and disableTickSound", () => {
    const r = parseConfig({ ...base, disableSound: true, disableTickSound: true });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.disableSound).toBe(true);
      expect(r.value.disableTickSound).toBe(true);
    }
  });
  it("defaults normalizeWeights to false (absolute weight mode)", () => {
    const r = parseConfig({ sliceEntries: "A, B [50%]" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.normalizeWeights).toBe(false);
      expect(r.value.slices.map((s) => s.weight as number)).toEqual([50, 50]);
    }
  });
  it("normalizeWeights=true reproduces the old relative-normalized behavior", () => {
    const r = parseConfig({ sliceEntries: "A [5], B [10%], C", normalizeWeights: true });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.slices.map((s) => s.weight as number)).toEqual([5, 10, 1]);
  });
});

describe("parseConfig: advancedConfig", () => {
  const advanced = JSON.stringify({
    categories: [{ id: "a", name: "A", weight: 1, color: "#112233" }],
    items: [{ text: "x", weight: 1, categoryId: "a" }],
  });

  it("an empty (default) advancedConfig is identical to today's sliceEntries-only behavior", () => {
    const withEmpty = parseConfig({ ...base, advancedConfig: "" });
    const withoutField = parseConfig({ ...base });
    expect(withEmpty.kind).toBe("ok");
    expect(withoutField.kind).toBe("ok");
    if (withEmpty.kind === "ok" && withoutField.kind === "ok") {
      expect(withEmpty.value.slices.map((s) => s.text)).toEqual(["A", "B"]);
      expect(withEmpty.value.slices).toEqual(withoutField.value.slices);
      expect(withEmpty.value.slices.every((s) => s.color === undefined)).toBe(true);
    }
  });

  it("a non-empty advancedConfig replaces sliceEntries entirely", () => {
    const r = parseConfig({ sliceEntries: "Ignored, Also Ignored", advancedConfig: advanced });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.slices.map((s) => s.text)).toEqual(["x"]);
      expect(r.value.slices[0]!.color).toBe("#112233");
    }
  });

  it("invalid advancedConfig JSON produces a typed ConfigError, not a throw or silent default", () => {
    expect(() => parseConfig({ ...base, advancedConfig: "{not json" })).not.toThrow();
    const r = parseConfig({ ...base, advancedConfig: "{not json" });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors.some((e) => e.kind === "bad-advanced-json")).toBe(true);
  });

  it("malformed advancedConfig structure produces a typed ConfigError", () => {
    const r = parseConfig({ ...base, advancedConfig: JSON.stringify({ categories: [], items: [{ text: "x" }] }) });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors.some((e) => e.kind === "bad-advanced-json")).toBe(true);
  });
});
