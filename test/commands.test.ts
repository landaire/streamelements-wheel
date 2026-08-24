import { describe, it, expect } from "vitest";
import { parseWheelCommand } from "../src/se/commands.js";

describe("parseWheelCommand", () => {
  it("parses add with its argument", () => {
    expect(parseWheelCommand("!wheel add Pizza", "!wheel")).toEqual({ cmd: "add", arg: "Pizza" });
  });
  it("parses remove with its argument", () => {
    expect(parseWheelCommand("!wheel remove Pizza", "!wheel")).toEqual({ cmd: "remove", arg: "Pizza" });
  });
  it("parses the no-argument subcommands", () => {
    expect(parseWheelCommand("!wheel spin", "!wheel")).toEqual({ cmd: "spin" });
    expect(parseWheelCommand("!wheel reset", "!wheel")).toEqual({ cmd: "reset" });
    expect(parseWheelCommand("!wheel pause", "!wheel")).toEqual({ cmd: "pause" });
    expect(parseWheelCommand("!wheel resume", "!wheel")).toEqual({ cmd: "resume" });
    expect(parseWheelCommand("!wheel list", "!wheel")).toEqual({ cmd: "list" });
  });
  it("is case-insensitive on both the base command and the subcommand", () => {
    expect(parseWheelCommand("!WHEEL ADD Pizza", "!wheel")).toEqual({ cmd: "add", arg: "Pizza" });
    expect(parseWheelCommand("!Wheel Spin", "!wheel")).toEqual({ cmd: "spin" });
  });
  it("tolerates repeated whitespace", () => {
    expect(parseWheelCommand("!wheel    add    Pizza  ", "!wheel")).toEqual({ cmd: "add", arg: "Pizza" });
  });
  it("returns undefined for an unrecognized subcommand", () => {
    expect(parseWheelCommand("!wheel bogus", "!wheel")).toBeUndefined();
  });
  it("the base command alone (no subcommand) spins", () => {
    expect(parseWheelCommand("!wheel", "!wheel")).toEqual({ cmd: "spin" });
    expect(parseWheelCommand("!wheel   ", "!wheel")).toEqual({ cmd: "spin" });
  });
  it("returns undefined for add/remove with no argument text", () => {
    expect(parseWheelCommand("!wheel add", "!wheel")).toBeUndefined();
    expect(parseWheelCommand("!wheel remove", "!wheel")).toBeUndefined();
  });
  it("returns undefined for text not starting with the base command", () => {
    expect(parseWheelCommand("hello !wheel spin", "!wheel")).toBeUndefined();
    expect(parseWheelCommand("!nope spin", "!wheel")).toBeUndefined();
  });
  it("respects a custom base command", () => {
    expect(parseWheelCommand("!fortune add Coffee", "!fortune")).toEqual({ cmd: "add", arg: "Coffee" });
  });
});
