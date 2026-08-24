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
  it("accepts the broadcaster by room-id == user-id, ignoring the channel name", () => {
    const owner: ChatEventData = { nick: "whoever", tags: { "room-id": "42", "user-id": "42" } };
    expect(isBroadcasterOrMod(owner, undefined)).toBe(true);
    expect(hasCommandPermission("broadcaster", owner, undefined)).toBe(true);
  });
  it("accepts a moderator/broadcaster by badges array", () => {
    const modByBadge: ChatEventData = { nick: "m", badges: [{ type: "moderator", version: "1" }] };
    const bcByBadge: ChatEventData = { nick: "b", badges: [{ type: "broadcaster", version: "1" }] };
    expect(isBroadcasterOrMod(modByBadge, "streamer")).toBe(true);
    expect(hasCommandPermission("broadcaster", modByBadge, "streamer")).toBe(false); // mod is not broadcaster
    expect(hasCommandPermission("broadcaster", bcByBadge, "streamer")).toBe(true);
  });
  it("accepts via the raw IRC badges tag string", () => {
    const bc: ChatEventData = { nick: "x", tags: { badges: "broadcaster/1,subscriber/12" } };
    expect(hasCommandPermission("broadcaster", bc, "streamer")).toBe(true);
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
