import { describe, it, expect } from "vitest";
import { parseRedemption } from "../src/se/redemption.js";

describe("parseRedemption", () => {
  it("parses the nested redemption.reward.title / redemption.userInput shape", () => {
    const detail = {
      listener: "channel-points-redemption",
      event: {
        data: {
          redemption: { reward: { title: "Add Wheel Entry" }, userInput: "Pizza" },
          nick: "viewer1",
        },
      },
    };
    const r = parseRedemption(detail);
    expect(r).toEqual({ rewardTitle: "Add Wheel Entry", userInput: "Pizza", username: "viewer1" });
  });

  it("parses a flatter reward.title / message shape", () => {
    const detail = {
      event: {
        listener: "event:reward-redeemed",
        data: { reward: { title: "Add Wheel Entry" }, message: "Tacos", displayName: "Viewer2" },
      },
    };
    const r = parseRedemption(detail);
    expect(r).toEqual({ rewardTitle: "Add Wheel Entry", userInput: "Tacos", username: "Viewer2" });
  });

  it("parses a flat data.title / data.input / data.username shape", () => {
    const detail = {
      listener: "reward",
      event: { data: { title: "Add Wheel Entry", input: "Burgers", username: "viewer3" } },
    };
    const r = parseRedemption(detail);
    expect(r).toEqual({ rewardTitle: "Add Wheel Entry", userInput: "Burgers", username: "viewer3" });
  });

  it("returns undefined when the listener does not mention redemption/reward", () => {
    const detail = { listener: "message", event: { data: { text: "hi" } } };
    expect(parseRedemption(detail)).toBeUndefined();
  });

  it("returns undefined when no reward title can be found", () => {
    const detail = { listener: "redemption", event: { data: { nick: "viewer1" } } };
    expect(parseRedemption(detail)).toBeUndefined();
  });
});
