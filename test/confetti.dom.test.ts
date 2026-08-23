import { describe, it, expect, vi } from "vitest";
import { createConfetti } from "../src/fx/confetti.js";

describe("confetti", () => {
  it("fire seeds particles and draws to the canvas context", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const c = createConfetti(canvas, ["#f00", "#0f0", "#00f"], () => 0, (cb) => cb());
      expect(() => c.fire()).not.toThrow();
      return;
    }
    const clearRect = vi.spyOn(ctx, "clearRect");
    let t = 0;
    const c = createConfetti(canvas, ["#f00", "#0f0", "#00f"], () => (t += 16), (cb) => cb());
    c.fire();
    expect(clearRect).toHaveBeenCalled();
  });
});
