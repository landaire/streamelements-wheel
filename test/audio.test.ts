import { describe, it, expect, vi } from "vitest";
import { createAudio } from "../src/audio/engine.js";

function mockCtx() {
  const gainNode = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const osc = { frequency: { setValueAtTime: vi.fn() }, type: "sine", connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  return {
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => gainNode),
    createOscillator: vi.fn(() => osc),
    _osc: osc,
  } as unknown as AudioContext & { _osc: typeof osc };
}

describe("audio", () => {
  it("tick synthesizes a click via the audio context", () => {
    const ctx = mockCtx();
    const audio = createAudio(() => ctx, {});
    audio.tick();
    expect((ctx as any)._osc.start).toHaveBeenCalled();
    expect((ctx as any)._osc.stop).toHaveBeenCalled();
  });
  it("win synthesizes a chime when no win sound is configured", () => {
    const ctx = mockCtx();
    const audio = createAudio(() => ctx, { winSound: undefined });
    audio.win();
    expect((ctx as any).createOscillator).toHaveBeenCalled();
  });
});
