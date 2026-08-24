import { describe, it, expect } from "vitest";
import { decodeSharedConfig, applyImportedConfig, encodeSharedConfig } from "../src/config/import.js";
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

  it("still decodes legacy (unprefixed) codes after compression is introduced", () => {
    const code = encode({ wheelTitle: "Legacy", spinDuration: 3 });
    expect(code.startsWith("LW1")).toBe(false);
    expect(decodeSharedConfig(code)).toEqual({ wheelTitle: "Legacy", spinDuration: 3 });
  });
});

describe("compressed config codec (LW1)", () => {
  it("encodeSharedConfig produces an LW1 code that decodeSharedConfig round-trips", async () => {
    const obj = {
      wheelTitle: "Compressed",
      // a realistic large value: a data-URL-ish base64 blob that benefits from compression
      hubImage: "data:image/png;base64," + "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5".repeat(400),
      sliceEntries: "A, B, C, D",
    };
    const code = await encodeSharedConfig(obj);
    expect(code.startsWith("LW1")).toBe(true);
    expect(decodeSharedConfig(code)).toEqual(obj);
  });

  it("compresses a repetitive payload well below its raw base64url size", async () => {
    const obj = { hubImage: "data:image/png;base64," + "A".repeat(20000) };
    const legacy = btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).length;
    const compressed = (await encodeSharedConfig(obj)).length;
    expect(compressed).toBeLessThan(legacy / 2); // highly repetitive -> big win
    expect(decodeSharedConfig(await encodeSharedConfig(obj))).toEqual(obj);
  });

  it("full share URL with an LW1 code decodes from the part after '#'", async () => {
    const code = await encodeSharedConfig({ wheelTitle: "UrlLW1" });
    expect(decodeSharedConfig("https://ex.com/#" + code)).toEqual({ wheelTitle: "UrlLW1" });
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
