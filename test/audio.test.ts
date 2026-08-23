import { describe, it, expect, vi, afterEach } from "vitest";
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

class MockAudio {
  url: string;
  play = vi.fn(() => Promise.resolve());

  constructor(url: string) {
    this.url = url;
  }
}

describe("audio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("win plays audio file when win sound is configured", () => {
    const MockAudioSpy = vi.fn((url: string) => new MockAudio(url));
    vi.stubGlobal("Audio", MockAudioSpy);
    const ctx = mockCtx();
    const audio = createAudio(() => ctx, { winSound: "https://example.com/win.mp3" });
    audio.win();
    expect(MockAudioSpy).toHaveBeenCalledWith("https://example.com/win.mp3");
    const result = MockAudioSpy.mock.results[0];
    const instance = result && result.value ? (result.value as InstanceType<typeof MockAudio>) : null;
    expect(instance).not.toBeNull();
    if (instance) {
      expect(instance.play).toHaveBeenCalled();
    }
    expect((ctx as any).createOscillator).not.toHaveBeenCalled();
  });

  it("reuses audio context across multiple calls", () => {
    const ctx = mockCtx();
    const ctxFactory = vi.fn(() => ctx);
    const audio = createAudio(ctxFactory, {});
    audio.tick();
    audio.tick();
    expect(ctxFactory).toHaveBeenCalledTimes(1);
  });
});
