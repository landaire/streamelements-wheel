import { describe, it, expect, vi } from "vitest";
import "../src/app.js";

// Importing src/app.js runs its top-level bootstrap, binding onWidgetLoad/onEventReceived
// window listeners exactly once for this test file's isolated jsdom environment.

function dispatchWidgetLoad(fieldData: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData, channel: { id: "1", username: "streamer" } } }));
}

function dispatchMessage(text: string, opts: { mod?: boolean; nick?: string } = {}): void {
  const data: Record<string, unknown> = { text, nick: opts.nick ?? "viewer" };
  if (opts.mod) data.tags = { mod: "1" };
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "message", event: { data } } }));
}

function spinDegree(): string {
  const wheel = document.querySelector(".wheel") as HTMLElement;
  return wheel.style.getPropertyValue("--spin-degree");
}

describe("SE chat-trigger integration", () => {
  it("auto-mounts on onWidgetLoad and spins only for an authorized !spin command", async () => {
    vi.useFakeTimers();

    dispatchWidgetLoad({ sliceEntries: "A, B, C, D", spinDuration: 0.05, spinCommand: "!spin", commandPermission: "mods" });
    expect(document.querySelectorAll(".slice").length).toBe(4);

    const initial = spinDegree();
    expect(initial).toBe("0deg");

    // Mod sends the configured command: spin should start immediately.
    dispatchMessage("!spin", { mod: true });
    const afterMod = spinDegree();
    expect(afterMod).not.toBe("0deg");
    const afterModTurns = parseFloat(afterMod);
    expect(afterModTurns).toBeGreaterThanOrEqual(5 * 360);

    // Let the spin finish so the animator accepts a new spin.
    await vi.advanceTimersByTimeAsync(0.05 * 1000 + 51);

    // Non-mod viewer with the right command: must not start a new spin.
    dispatchMessage("!spin", { mod: false });
    expect(spinDegree()).toBe(afterMod);

    // Mod with the wrong command: must not start a new spin.
    dispatchMessage("!nope", { mod: true });
    expect(spinDegree()).toBe(afterMod);

    vi.useRealTimers();
  });
});
