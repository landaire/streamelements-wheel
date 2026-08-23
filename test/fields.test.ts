import { describe, it, expect } from "vitest";
import { buildFieldsSchema, FIELD_DEFS } from "../src/config/fields.js";
import { parseConfig } from "../src/config/parse.js";
import type { FieldData } from "../src/se/types.js";

describe("fields schema", () => {
  const schema = buildFieldsSchema();

  it("covers every key parseConfig reads", () => {
    const required = ["sliceEntries", "wheelStyle", "wheelTitle", "spinDuration", "countdownTime", "countdownText", "spinningText", "magnetism", "seamBand", "respinText", "colorScheme", "centerIcon", "scaleWidget", "soundWin", "soundTick", "disableConfetti"];
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
});
