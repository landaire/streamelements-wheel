import { describe, it, expect, vi, afterEach } from "vitest";
import { createConfetti } from "../src/fx/confetti.js";

describe("confetti", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fire does not throw when canvas context is null", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const c = createConfetti(canvas, ["#f00", "#0f0", "#00f"], () => 0, (cb) => cb());
      expect(() => c.fire()).not.toThrow();
      return;
    }
  });

  it("fire seeds particles and draws to the canvas context via render loop", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;

    let frames = 0;
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
    };

    vi.spyOn(canvas, "getContext").mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);

    const raf = (cb: () => void): void => {
      if (frames++ < 500) cb();
    };

    const c = createConfetti(canvas, ["#f00", "#0f0", "#00f"], () => 0, raf);
    c.fire();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(frames).toBeLessThan(500);
  });
});
