import { describe, it, expect } from "vitest";
import { decodeSharedConfig, applyImportedConfig } from "../src/config/import.js";
import { FIELD_DEFAULTS } from "../src/config/fields.js";

// Mirrors the playground's base64url encoder so tests build codes the same way users do.
function encode(obj: Record<string, unknown>): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("decodeSharedConfig", () => {
  it("round-trips an encoded config object", () => {
    const code = encode({ wheelTitle: "Hi", spinDuration: 7, magnetism: true });
    expect(decodeSharedConfig(code)).toEqual({ wheelTitle: "Hi", spinDuration: 7, magnetism: true });
  });

  it("accepts a full share URL and decodes the part after '#'", () => {
    const code = encode({ wheelTitle: "FromUrl" });
    expect(decodeSharedConfig("https://example.com/demo.html#" + code)).toEqual({ wheelTitle: "FromUrl" });
  });

  it("returns undefined for empty, whitespace, or malformed input", () => {
    expect(decodeSharedConfig("")).toBeUndefined();
    expect(decodeSharedConfig("   ")).toBeUndefined();
    expect(decodeSharedConfig("not-valid-base64!!!")).toBeUndefined();
    expect(decodeSharedConfig(encode(["a", "b"] as unknown as Record<string, unknown>))).toBeUndefined(); // arrays rejected
  });
});

describe("applyImportedConfig", () => {
  it("leaves field data untouched when importConfig is absent or empty", () => {
    const fd = { wheelTitle: "Manual", spinDuration: 3 };
    expect(applyImportedConfig(fd)).toBe(fd);
    expect(applyImportedConfig({ ...fd, importConfig: "" })).toEqual({ ...fd, importConfig: "" });
  });

  it("leaves field data untouched when the code is malformed", () => {
    const fd = { importConfig: "@@@bad@@@", wheelTitle: "Manual" };
    expect(applyImportedConfig(fd)).toBe(fd);
  });

  it("a valid code is authoritative: defaults overlaid with the decoded diff", () => {
    const code = encode({ wheelTitle: "Shared", spinDuration: 9 });
    // an individual field (colorScheme) is set, but the imported code did not include it,
    // so the result uses the DEFAULT, not the individually-set value.
    const result = applyImportedConfig({ importConfig: code, colorScheme: "grape" });
    expect(result.wheelTitle).toBe("Shared"); // from the code
    expect(result.spinDuration).toBe(9); // from the code
    expect(result.colorScheme).toBe(FIELD_DEFAULTS.colorScheme); // default, NOT "grape"
    expect(result.importConfig).toBe(""); // cleared, so re-applying is a no-op
  });

  it("is idempotent (applying twice yields the same result)", () => {
    const code = encode({ wheelTitle: "Shared" });
    const once = applyImportedConfig({ importConfig: code });
    expect(applyImportedConfig(once)).toEqual(once);
  });
});
