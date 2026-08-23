import { describe, it, expect } from "vitest";
import { resolveScheme } from "../src/config/schemes.js";

describe("resolveScheme", () => {
  it("default/absent colorScheme -> auto, palette derived from the default main colors", () => {
    const r = resolveScheme({});
    expect(r.kind).toBe("named");
    if (r.kind === "named") {
      expect(r.name).toBe("auto");
      // every derived var is a valid hex color
      for (const key of ["--slice-bg-even", "--slice-bg-odd", "--slice-border", "--centerpiece-bg", "--rim-color", "--hub-inner", "--plate-bg", "--title-color"]) {
        expect(r.vars[key]).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(r.vars["--entry-color"]).toBe("#ffffff");
    }
  });

  it("auto derives tones from the primary hue (a red primary yields red-ish slices)", () => {
    const r = resolveScheme({ colorScheme: "auto", colorPrimary: "#ff0000" });
    expect(r.kind).toBe("named");
    if (r.kind === "named") {
      // the darker slice keeps the primary's red hue: r channel dominates
      const even = r.vars["--slice-bg-even"]!;
      const rr = parseInt(even.slice(1, 3), 16);
      const gg = parseInt(even.slice(3, 5), 16);
      const bb = parseInt(even.slice(5, 7), 16);
      expect(rr).toBeGreaterThan(gg);
      expect(rr).toBeGreaterThan(bb);
    }
  });

  it("named preset (grape) still carries its fixed palette vars", () => {
    const r = resolveScheme({ colorScheme: "grape" });
    expect(r.kind).toBe("named");
    if (r.kind === "named") expect(r.vars["--slice-bg-even"]).toBe("#ab4bb8");
  });

  it("custom colorScheme maps color pickers to the real CSS vars", () => {
    const r = resolveScheme({
      colorScheme: "custom",
      colorSliceEven: "#112233",
      colorSliceOdd: "#445566",
      colorRim: "#778899",
      colorTitle: "#aabbcc",
      colorNope: "#ffffff", // unmapped -> ignored
    });
    expect(r.kind).toBe("custom");
    if (r.kind === "custom") {
      expect(r.vars["--slice-bg-even"]).toBe("#112233");
      expect(r.vars["--slice-bg-odd"]).toBe("#445566");
      expect(r.vars["--rim-color"]).toBe("#778899");
      expect(r.vars["--title-color"]).toBe("#aabbcc");
      expect(r.vars["--colorNope"]).toBeUndefined();
      expect(r.vars["--colorScheme"]).toBeUndefined();
    }
  });
});
