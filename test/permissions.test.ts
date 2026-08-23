import { describe, it, expect } from "vitest";
import { hasCommandPermission, isBroadcasterOrMod } from "../src/se/permissions.js";
import type { ChatEventData } from "../src/se/types.js";

const viewer: ChatEventData = { nick: "viewer1" };
const mod: ChatEventData = { nick: "modperson", tags: { mod: "1" } };
const broadcaster: ChatEventData = { nick: "streamer" };

describe("isBroadcasterOrMod", () => {
  it("rejects a plain viewer", () => {
    expect(isBroadcasterOrMod(viewer, "streamer")).toBe(false);
  });
  it("accepts a mod via tags.mod", () => {
    expect(isBroadcasterOrMod(mod, "streamer")).toBe(true);
  });
  it("accepts the broadcaster by nick match", () => {
    expect(isBroadcasterOrMod(broadcaster, "streamer")).toBe(true);
  });
});

describe("hasCommandPermission", () => {
  it("mods permission: viewer rejected, mod allowed, broadcaster allowed", () => {
    expect(hasCommandPermission("mods", viewer, "streamer")).toBe(false);
    expect(hasCommandPermission("mods", mod, "streamer")).toBe(true);
    expect(hasCommandPermission("mods", broadcaster, "streamer")).toBe(true);
  });
  it("broadcaster permission: mod rejected, broadcaster allowed", () => {
    expect(hasCommandPermission("broadcaster", mod, "streamer")).toBe(false);
    expect(hasCommandPermission("broadcaster", broadcaster, "streamer")).toBe(true);
  });
});
