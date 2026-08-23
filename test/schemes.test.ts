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

  it("custom colorScheme with color fields -> custom vars without colorScheme", () => {
    const r = resolveScheme({
      colorScheme: "custom",
      colorWin: "#ff0000",
      colorLose: "#00ff00",
      colorBg: "#0000ff",
    });
    expect(r.kind).toBe("custom");
    if (r.kind === "custom") {
      expect(r.vars["--colorWin"]).toBe("#ff0000");
      expect(r.vars["--colorLose"]).toBe("#00ff00");
      expect(r.vars["--colorBg"]).toBe("#0000ff");
      expect(r.vars["--colorScheme"]).toBeUndefined();
    }
  });
});
