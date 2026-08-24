import { describe, it, expect, vi } from "vitest";
import { createController, type WheelController } from "../src/app/controller.js";
import { memoryStore } from "../src/se/store.js";
import type { WidgetLoadDetail, ChatEventData } from "../src/se/types.js";

function detail(fieldData: Record<string, unknown> = {}): WidgetLoadDetail {
  return {
    fieldData: { sliceEntries: "A, B", ...fieldData },
    channel: { id: "chan1", username: "streamer" },
  };
}

function chatData(nick: string, mod = false): ChatEventData {
  return mod ? { nick, tags: { mod: "1" } } : { nick };
}

function makeController(fieldData: Record<string, unknown> = {}): WheelController {
  const parent = document.createElement("div");
  const created = createController(document, parent, detail(fieldData), { store: memoryStore() });
  if ("error" in created) throw new Error("bad config");
  return created;
}

describe("WheelController.addEntry", () => {
  it("adds an entry and reflects it in the effective slice list", () => {
    const c = makeController();
    const r = c.addEntry("Pizza", "viewer1");
    expect(r).toEqual({ kind: "added", entry: { text: "Pizza", user: "viewer1" } });
    expect(c.entries()).toEqual(["A", "B", "Pizza"]);
  });

  it("rejects once addEntryMax is reached (reward limits enforced)", () => {
    const c = makeController({ addEntryMax: 1 });
    expect(c.addEntry("Pizza", "viewer1", { enforceRewardLimits: true }).kind).toBe("added");
    expect(c.addEntry("Tacos", "viewer2", { enforceRewardLimits: true })).toEqual({ kind: "rejected", reason: "max-reached" });
  });

  it("trusted (command) adds ignore the reward max", () => {
    const c = makeController({ addEntryMax: 1 });
    expect(c.addEntry("Pizza").kind).toBe("added");
    expect(c.addEntry("Tacos").kind).toBe("added"); // no enforceRewardLimits -> max not applied
  });

  it("addEntryMax 0 means unlimited", () => {
    const c = makeController({ addEntryMax: 0 });
    for (let i = 0; i < 5; i++) expect(c.addEntry("Entry" + i, "user" + i).kind).toBe("added");
    expect(c.entries().length).toBe(2 + 5);
  });

  it("rejects a second entry from the same user when addEntryOnePerUser is on (reward limits enforced)", () => {
    const c = makeController({ addEntryOnePerUser: true });
    expect(c.addEntry("Pizza", "viewer1", { enforceRewardLimits: true }).kind).toBe("added");
    expect(c.addEntry("Tacos", "viewer1", { enforceRewardLimits: true })).toEqual({ kind: "rejected", reason: "duplicate-user" });
  });

  it("allows a second entry from the same user when addEntryOnePerUser is off", () => {
    const c = makeController({ addEntryOnePerUser: false });
    expect(c.addEntry("Pizza", "viewer1").kind).toBe("added");
    expect(c.addEntry("Tacos", "viewer1").kind).toBe("added");
  });

  it("dedupes identical text (case-insensitive) regardless of user", () => {
    const c = makeController({ addEntryOnePerUser: false });
    expect(c.addEntry("Pizza", "viewer1").kind).toBe("added");
    expect(c.addEntry("pizza", "viewer2")).toEqual({ kind: "rejected", reason: "duplicate-text" });
  });

  it("rejects empty/whitespace-only text", () => {
    const c = makeController();
    expect(c.addEntry("   ", "viewer1")).toEqual({ kind: "rejected", reason: "empty-text" });
  });
});

describe("WheelController.removeEntry / resetEntries", () => {
  it("removeEntry removes a matching extra case-insensitively", () => {
    const c = makeController();
    c.addEntry("Pizza", "viewer1");
    expect(c.removeEntry("PIZZA")).toEqual({ kind: "removed" });
    expect(c.entries()).toEqual(["A", "B"]);
  });

  it("removeEntry reports not-found for a base slice or unknown text", () => {
    const c = makeController();
    expect(c.removeEntry("A")).toEqual({ kind: "not-found" });
    expect(c.removeEntry("Nope")).toEqual({ kind: "not-found" });
  });

  it("resetEntries clears all extras but leaves base slices", () => {
    const c = makeController();
    c.addEntry("Pizza", "viewer1");
    c.addEntry("Tacos", "viewer2");
    c.resetEntries();
    expect(c.entries()).toEqual(["A", "B"]);
  });
});

describe("WheelController import config", () => {
  function encode(obj: Record<string, unknown>): string {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  it("applies a pasted config code and still appends chat-added extras on top", () => {
    const code = encode({ sliceEntries: "X, Y" });
    // an individual sliceEntries is set too, but the import code is authoritative
    const c = makeController({ importConfig: code, sliceEntries: "A, B, C" });
    expect(c.entries()).toEqual(["X", "Y"]);
    c.addEntry("Z", "viewer1");
    expect(c.entries()).toEqual(["X", "Y", "Z"]);
  });
});

describe("WheelController spin serialization", () => {
  it("defers a mid-spin rebuild until the spin settles, without interrupting it", async () => {
    const parent = document.createElement("div");
    const created = createController(document, parent, detail({ spinDuration: 0.05, sliceEntries: "A, B" }), { store: memoryStore() });
    if ("error" in created) throw new Error("bad config");
    await created.ready;
    expect(parent.querySelectorAll(".entry").length).toBe(2);

    created.spin();
    created.addEntry("C"); // mutate while the wheel is mid-spin
    expect(created.entries()).toEqual(["A", "B", "C"]); // data updates immediately
    expect(parent.querySelectorAll(".entry").length).toBe(2); // but the DOM rebuild is deferred

    await new Promise((r) => setTimeout(r, 140)); // let the spin settle
    expect(parent.querySelectorAll(".entry").length).toBe(3); // rebuilt once, after settle
  });
});

describe("WheelController.handleChatMessage permission gating", () => {
  it("rejects a viewer's add command", () => {
    const c = makeController({ wheelCommand: "!wheel", commandPermission: "mods" });
    c.handleChatMessage("!wheel add Pizza", chatData("viewer1"), "streamer");
    expect(c.entries()).toEqual(["A", "B"]);
  });

  it("allows a mod's add command", () => {
    const c = makeController({ wheelCommand: "!wheel", commandPermission: "mods" });
    c.handleChatMessage("!wheel add Pizza", chatData("modperson", true), "streamer");
    expect(c.entries()).toEqual(["A", "B", "Pizza"]);
  });

  it("commandPermission=broadcaster rejects a mod", () => {
    const c = makeController({ wheelCommand: "!wheel", commandPermission: "broadcaster" });
    c.handleChatMessage("!wheel add Pizza", chatData("modperson", true), "streamer");
    expect(c.entries()).toEqual(["A", "B"]);
  });

  it("ignores commands entirely when enableCommands is false", () => {
    const c = makeController({ enableCommands: false });
    c.handleChatMessage("!wheel add Pizza", chatData("streamer"), "streamer");
    expect(c.entries()).toEqual(["A", "B"]);
  });

  it("routes reset/pause/resume/list", () => {
    const list = { list: vi.fn() };
    const parent = document.createElement("div");
    const created = createController(document, parent, detail(), { store: memoryStore(), announceList: list });
    if ("error" in created) throw new Error("bad config");
    created.handleChatMessage("!wheel add Pizza", chatData("streamer"), "streamer");
    created.handleChatMessage("!wheel pause", chatData("streamer"), "streamer");
    expect(created.isPaused()).toBe(true);
    created.handleChatMessage("!wheel resume", chatData("streamer"), "streamer");
    expect(created.isPaused()).toBe(false);
    created.handleChatMessage("!wheel list", chatData("streamer"), "streamer");
    expect(list.list).toHaveBeenCalledWith(["A", "B", "Pizza"]);
    created.handleChatMessage("!wheel reset", chatData("streamer"), "streamer");
    expect(created.entries()).toEqual(["A", "B"]);
  });

  it("a paused controller ignores spin requests until resumed", () => {
    const c = makeController();
    c.pause();
    c.spin();
    expect(c.isPaused()).toBe(true);
    // spin() itself must not throw and must be a no-op while paused; nothing further
    // to assert headlessly beyond isPaused, since the animator is internal to render().
    c.resume();
    expect(c.isPaused()).toBe(false);
  });
});

describe("WheelController.handleRedemption", () => {
  it("adds an entry from a matching channel-point redemption (input source)", () => {
    const c = makeController({ enableAddEntryReward: true, addEntryRewardName: "Add Wheel Entry", addEntrySource: "input" });
    c.handleRedemption({
      listener: "channel-points-redemption",
      event: { data: { redemption: { reward: { title: "Add Wheel Entry" }, userInput: "Pizza" }, nick: "viewer1" } },
    });
    expect(c.entries()).toEqual(["A", "B", "Pizza"]);
  });

  it("uses the username when addEntrySource is username", () => {
    const c = makeController({ enableAddEntryReward: true, addEntryRewardName: "Add Wheel Entry", addEntrySource: "username" });
    c.handleRedemption({
      listener: "channel-points-redemption",
      event: { data: { redemption: { reward: { title: "Add Wheel Entry" }, userInput: "Pizza" }, nick: "viewer1" } },
    });
    expect(c.entries()).toEqual(["A", "B", "viewer1"]);
  });

  it("ignores a redemption for a different reward", () => {
    const c = makeController({ enableAddEntryReward: true, addEntryRewardName: "Add Wheel Entry" });
    c.handleRedemption({
      listener: "channel-points-redemption",
      event: { data: { redemption: { reward: { title: "Some Other Reward" }, userInput: "Pizza" }, nick: "viewer1" } },
    });
    expect(c.entries()).toEqual(["A", "B"]);
  });

  it("ignores redemptions entirely when enableAddEntryReward is false", () => {
    const c = makeController({ enableAddEntryReward: false, addEntryRewardName: "Add Wheel Entry" });
    c.handleRedemption({
      listener: "channel-points-redemption",
      event: { data: { redemption: { reward: { title: "Add Wheel Entry" }, userInput: "Pizza" }, nick: "viewer1" } },
    });
    expect(c.entries()).toEqual(["A", "B"]);
  });
});

describe("WheelController persistence", () => {
  it("round-trips extras through a shared store: a new controller loads the extra", async () => {
    const store = memoryStore();
    const parent1 = document.createElement("div");
    const c1 = createController(document, parent1, detail(), { store });
    if ("error" in c1) throw new Error("bad config");
    c1.addEntry("Pizza", "viewer1");
    await c1.flush();

    const parent2 = document.createElement("div");
    const c2 = createController(document, parent2, detail(), { store });
    if ("error" in c2) throw new Error("bad config");
    await c2.ready;
    expect(c2.entries()).toEqual(["A", "B", "Pizza"]);
  });

  it("a fresh channel with no persisted data starts with only base slices", async () => {
    const store = memoryStore();
    const parent = document.createElement("div");
    const c = createController(document, parent, detail(), { store });
    if ("error" in c) throw new Error("bad config");
    await c.ready;
    expect(c.entries()).toEqual(["A", "B"]);
  });
});

describe("WheelController with advancedConfig", () => {
  const advanced = JSON.stringify({
    categories: [{ id: "a", name: "A", weight: 1 }],
    items: [{ text: "x", weight: 1, categoryId: "a" }],
  });

  it("addEntry still works, appending as an Uncategorized item", () => {
    const c = makeController({ advancedConfig: advanced });
    expect(c.addEntry("Pizza", "viewer1").kind).toBe("added");
    expect(c.entries()).toEqual(["x", "Pizza"]);
  });

  it("!wheel add via chat command still renders the extra", () => {
    const c = makeController({ advancedConfig: advanced, wheelCommand: "!wheel" });
    c.handleChatMessage("!wheel add Tacos", chatData("streamer"), "streamer");
    expect(c.entries()).toEqual(["x", "Tacos"]);
  });

  it("removeEntry and resetEntries still work on advancedConfig extras", () => {
    const c = makeController({ advancedConfig: advanced });
    c.addEntry("Pizza", "viewer1");
    expect(c.removeEntry("Pizza")).toEqual({ kind: "removed" });
    expect(c.entries()).toEqual(["x"]);
    c.addEntry("Tacos", "viewer2");
    c.resetEntries();
    expect(c.entries()).toEqual(["x"]);
  });
});
