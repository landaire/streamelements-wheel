import { describe, it, expect } from "vitest";
import { buildFieldsSchema, FIELD_DEFAULTS, FIELD_DEFS } from "../src/config/fields.js";
import { parseConfig } from "../src/config/parse.js";
import type { FieldData } from "../src/se/types.js";

describe("fields schema", () => {
  const schema = buildFieldsSchema();

  it("covers every key parseConfig reads", () => {
    const required = ["sliceEntries", "normalizeWeights", "advancedConfig", "wheelStyle", "wheelTitle", "spinDuration", "countdownTime", "countdownText", "spinningText", "magnetism", "seamBand", "respinText", "spinCommand", "colorScheme", "centerIcon", "hubMode", "hubImage", "hubText", "hubTextStyle", "scaleWidget", "soundWin", "soundTick", "disableConfetti", "disableSound", "disableTickSound", "enableCommands", "wheelCommand", "commandPermission", "enableAddEntryReward", "addEntryRewardName", "addEntrySource", "addEntryMax", "addEntryOnePerUser"];
    for (const key of required) expect(schema[key], `missing field: ${key}`).toBeDefined();
  });

  it("field defaults parse into a valid config", () => {
    const fd: FieldData = {};
    for (const f of FIELD_DEFS) fd[f.key] = f.value;
    const r = parseConfig(fd);
    expect(r.kind).toBe("ok");
  });

  it("FIELD_DEFAULTS matches each def value", () => {
    for (const f of FIELD_DEFS) expect(schema[f.key]).toMatchObject({ value: f.value });
  });

  it("parseConfig falls back to FIELD_DEFAULTS for wheelStyle and colorScheme when omitted", () => {
    const r = parseConfig({ sliceEntries: "A, B" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.style).toBe(FIELD_DEFAULTS.wheelStyle);
      expect(r.value.scheme).toMatchObject({ kind: "named", name: FIELD_DEFAULTS.colorScheme });
    }
  });
});
