import { describe, it, expect, vi, afterEach } from "vitest";
import { createAudio } from "../src/audio/engine.js";

function mockCtx() {
  const gainNode = { gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const osc = {
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    type: "sine",
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const bufferSource = { buffer: null as unknown, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const filter = { type: "bandpass", frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn() };
  return {
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createGain: vi.fn(() => gainNode),
    createOscillator: vi.fn(() => osc),
    createBuffer: vi.fn((_ch: number, frames: number) => ({ getChannelData: () => new Float32Array(frames) })),
    createBufferSource: vi.fn(() => bufferSource),
    createBiquadFilter: vi.fn(() => filter),
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

  it("win plays the embedded ka-ching (via Audio) when winStyle is cash and no URL", () => {
    const MockAudioSpy = vi.fn((url: string) => new MockAudio(url));
    vi.stubGlobal("Audio", MockAudioSpy);
    const ctx = mockCtx();
    const audio = createAudio(() => ctx, { winStyle: "cash" });
    audio.win();
    expect(MockAudioSpy).toHaveBeenCalled();
    expect(String(MockAudioSpy.mock.calls[0]?.[0])).toMatch(/^data:audio\/mpeg;base64,/);
    expect((ctx as any).createOscillator).not.toHaveBeenCalled();
  });

  it("seam synthesizes a chime when no seam sound is configured", () => {
    const ctx = mockCtx();
    const audio = createAudio(() => ctx, {});
    audio.seam();
    expect((ctx as any).createOscillator).toHaveBeenCalled();
    expect((ctx as any)._osc.start).toHaveBeenCalled();
  });

  it("seam plays an audio file when a seam sound is configured", () => {
    const MockAudioSpy = vi.fn((url: string) => new MockAudio(url));
    vi.stubGlobal("Audio", MockAudioSpy);
    const ctx = mockCtx();
    const audio = createAudio(() => ctx, { seamSound: "https://example.com/seam.mp3" });
    audio.seam();
    expect(MockAudioSpy).toHaveBeenCalledWith("https://example.com/seam.mp3");
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
