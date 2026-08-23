import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseConfig } from "../src/config/parse.js";

describe("fields.json", () => {
  const fields = JSON.parse(readFileSync("fields.json", "utf8")) as Record<string, { type: string; value?: unknown }>;

  it("every parsed key has a field (or is a documented sub-key)", () => {
    const required = ["sliceEntries", "wheelStyle", "wheelTitle", "spinDuration", "countdownTime", "countdownText", "spinningText", "magnetism", "seamBand", "respinText", "colorScheme", "centerIcon", "scaleWidget", "soundWin", "soundTick", "disableConfetti"];
    for (const key of required) expect(fields[key], `missing field: ${key}`).toBeDefined();
  });

  it("field defaults parse into a valid config", () => {
    const fd: Record<string, unknown> = {};
    for (const [k, def] of Object.entries(fields)) if ("value" in def) fd[k] = def.value;
    const r = parseConfig(fd as any);
    expect(r.kind).toBe("ok");
  });
});
