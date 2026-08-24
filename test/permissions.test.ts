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
  it("accepts any moderator-variant badge (e.g. a lead moderator)", () => {
    const leadByBadge: ChatEventData = { nick: "l", badges: [{ type: "lead_moderator", version: "1" }] };
    const leadByTag: ChatEventData = { nick: "l", tags: { badges: "lead_moderator/1" } };
    expect(isBroadcasterOrMod(leadByBadge, "streamer")).toBe(true);
    expect(isBroadcasterOrMod(leadByTag, "streamer")).toBe(true);
  });
});

describe("hasCommandPermission tiers (broadcaster / leadmods / mods)", () => {
  const regularMod: ChatEventData = { nick: "m", tags: { mod: "1" } };
  const leadMod: ChatEventData = { nick: "l", tags: { mod: "1", badges: "lead_moderator/1" } };
  const bc: ChatEventData = { nick: "streamer" };

  it("leadmods: broadcaster and lead mods allowed, regular mods not", () => {
    expect(hasCommandPermission("leadmods", bc, "streamer")).toBe(true);
    expect(hasCommandPermission("leadmods", leadMod, "streamer")).toBe(true);
    expect(hasCommandPermission("leadmods", regularMod, "streamer")).toBe(false);
  });
  it("mods: broadcaster, lead mods, and regular mods all allowed", () => {
    expect(hasCommandPermission("mods", bc, "streamer")).toBe(true);
    expect(hasCommandPermission("mods", leadMod, "streamer")).toBe(true);
    expect(hasCommandPermission("mods", regularMod, "streamer")).toBe(true);
  });
  it("broadcaster: only the broadcaster, not any moderator", () => {
    expect(hasCommandPermission("broadcaster", bc, "streamer")).toBe(true);
    expect(hasCommandPermission("broadcaster", leadMod, "streamer")).toBe(false);
    expect(hasCommandPermission("broadcaster", regularMod, "streamer")).toBe(false);
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
