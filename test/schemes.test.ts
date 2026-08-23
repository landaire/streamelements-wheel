import { describe, it, expect } from "vitest";
import { resolveScheme } from "../src/config/schemes.js";

describe("resolveScheme", () => {
  it("default/absent colorScheme -> named grape with palette vars", () => {
    const r = resolveScheme({});
    expect(r.kind).toBe("named");
    if (r.kind === "named") {
      expect(r.name).toBe("grape");
      expect(r.vars["--slice-bg-even"]).toBe("#ab4bb8");
      expect(r.vars["--slice-bg-odd"]).toBe("#d9a9e8");
    }
  });

  it("named sweetheart-original carries its palette vars", () => {
    const r = resolveScheme({ colorScheme: "sweetheart-original" });
    expect(r.kind).toBe("named");
    if (r.kind === "named") expect(r.vars["--slice-bg-even"]).toBe("#f8acba");
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
