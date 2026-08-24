import { describe, it, expect, vi } from "vitest";
import { mountWidget } from "../src/app.js";

describe("mountWidget", () => {
  it("mounts a wheel and spins to a resolved result", async () => {
    vi.useFakeTimers();
    const handle = mountWidget(document, { fieldData: { sliceEntries: "A, B, C, D", spinDuration: 0.01 } }, { rng: () => 0.1 });
    expect("root" in handle).toBe(true);
    if ("root" in handle) {
      expect(document.querySelectorAll(".slice").length).toBe(4);
      handle.spin();
      await vi.advanceTimersByTimeAsync(200);
      const title = document.querySelector(".title-text")!.textContent!;
      expect(title.length).toBeGreaterThan(0);
    }
    vi.useRealTimers();
  });
  it("renders the default wheel (no error) when the slice list is missing (back-compat)", () => {
    const handle = mountWidget(document, { fieldData: {} });
    expect("error" in handle).toBe(false);
    expect(document.querySelector(".wheel-error")).toBeNull();
    expect(document.querySelector(".wheel-container")).not.toBeNull();
  });
});
