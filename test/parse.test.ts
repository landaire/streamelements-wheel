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
      expect(r.value.seamBandDeg as number).toBe(3);
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
  it("empty sound field becomes undefined, not empty string", () => {
    const r = parseConfig({ ...base, soundWin: "" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.winSound).toBeUndefined();
  });
  it("errors when the slice list is missing", () => {
    const r = parseConfig({});
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors.some((e) => e.kind === "missing-field")).toBe(true);
  });
  it("errors when sliceEntries is a non-string", () => {
    const r = parseConfig({ sliceEntries: 5 });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.errors.some((e) => e.kind === "bad-field-type")).toBe(true);
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
});
