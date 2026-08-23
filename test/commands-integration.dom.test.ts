import { describe, it, expect, beforeEach } from "vitest";
import "../src/app.js";

// Importing src/app.js runs its top-level bootstrap, binding onWidgetLoad/onEventReceived
// window listeners exactly once for this test file's isolated jsdom environment.

function dispatchWidgetLoad(fieldData: Record<string, unknown>): void {
  window.dispatchEvent(
    new CustomEvent("onWidgetLoad", { detail: { fieldData, channel: { id: "chan-int", username: "streamer" } } }),
  );
}

function dispatchMessage(text: string, opts: { mod?: boolean; nick?: string } = {}): void {
  const data: Record<string, unknown> = { text, nick: opts.nick ?? "viewer" };
  if (opts.mod) data.tags = { mod: "1" };
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "message", event: { data } } }));
}

function dispatchRedemption(rewardTitle: string, userInput: string, nick: string): void {
  window.dispatchEvent(
    new CustomEvent("onEventReceived", {
      detail: {
        listener: "channel-points-redemption",
        event: { data: { redemption: { reward: { title: rewardTitle }, userInput }, nick } },
      },
    }),
  );
}

function entryTexts(): string[] {
  return Array.from(document.querySelectorAll(".entry .entry-text")).map((e) => e.textContent ?? "");
}

describe("SE chat command + redemption integration", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("mod !wheel add adds a slice; viewer add is rejected; reset clears extras", () => {
    dispatchWidgetLoad({ sliceEntries: "A, B, C, D", wheelCommand: "!wheel", commandPermission: "mods" });
    expect(entryTexts()).toEqual(["A", "B", "C", "D"]);

    dispatchMessage("!wheel add Pizza", { mod: true });
    expect(entryTexts()).toEqual(["A", "B", "C", "D", "Pizza"]);

    dispatchMessage("!wheel add Nope", { mod: false });
    expect(entryTexts()).toEqual(["A", "B", "C", "D", "Pizza"]);

    dispatchMessage("!wheel reset", { mod: true });
    expect(entryTexts()).toEqual(["A", "B", "C", "D"]);
  });

  it("a matching channel-point redemption adds an entry", () => {
    dispatchWidgetLoad({
      sliceEntries: "A, B",
      enableAddEntryReward: true,
      addEntryRewardName: "Add Wheel Entry",
      addEntrySource: "input",
    });
    expect(entryTexts()).toEqual(["A", "B"]);

    dispatchRedemption("Add Wheel Entry", "Tacos", "viewer9");
    expect(entryTexts()).toEqual(["A", "B", "Tacos"]);
  });

  it("a redemption for a non-matching reward is ignored", () => {
    dispatchWidgetLoad({
      sliceEntries: "A, B",
      enableAddEntryReward: true,
      addEntryRewardName: "Add Wheel Entry",
      addEntrySource: "input",
    });
    dispatchRedemption("Some Other Reward", "Tacos", "viewer9");
    expect(entryTexts()).toEqual(["A", "B"]);
  });
});
