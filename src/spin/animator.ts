import type { WheelDom } from "../render/wheel.js";
import type { WheelConfig } from "../config/parse.js";
import { layout } from "../model/geometry.js";
import {
  resolveLanding,
  pickRestAngle,
  pickSpins,
  nextRotation,
  type SpinResult,
  type Rng,
} from "../model/spin.js";

export interface SpinHooks {
  onResult(result: SpinResult): void;
  onStart?(): void;
  onTick?(): void;
}

export interface Animator {
  spin(): void;
  isSpinning(): boolean;
}

const SETTLE_GRACE_MS = 50; // fallback past transitionend for headless environments

// Reads the wheel's current rotation (degrees, in [-180, 180]) from its computed transform
// matrix. Returns undefined when no transform is applied (e.g. jsdom without the wheel
// stylesheet loaded), which is the signal to stay inert rather than drive fake ticks.
function readTransformAngleDeg(elm: HTMLElement): number | undefined {
  if (typeof getComputedStyle !== "function") return undefined;
  const transform = getComputedStyle(elm).transform;
  if (!transform || transform === "none") return undefined;
  const match = /matrix\(([^)]+)\)/.exec(transform);
  if (!match) return undefined;
  const parts = match[1]!.split(",").map((p) => Number(p.trim()));
  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return Math.atan2(b, a) * (180 / Math.PI);
}

// Drives onTick once per (360 / sliceCount) degrees of ACTUAL rendered rotation, sampled via
// requestAnimationFrame from the wheel's computed transform. Stops once isDone() is true, and
// never reschedules a frame if a rotation reading is unavailable, so it is inert under jsdom.
function driveTicks(wheelEl: HTMLElement, sliceCount: number, onTick: () => void, isDone: () => boolean): void {
  if (typeof requestAnimationFrame !== "function") return;
  const stepDeg = 360 / sliceCount;
  let laps = 0;
  let lastRaw: number | undefined;
  let nextThreshold = stepDeg;

  const frame = (): void => {
    if (isDone()) return;
    const raw = readTransformAngleDeg(wheelEl);
    if (raw === undefined) return; // no computed transform available; stay inert
    if (lastRaw !== undefined && raw < lastRaw - 180) laps += 1; // wrapped 180 -> -180
    lastRaw = raw;
    const accumulated = laps * 360 + raw;
    while (accumulated >= nextThreshold) {
      onTick();
      nextThreshold += stepDeg;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function createAnimator(
  dom: WheelDom,
  cfg: WheelConfig,
  hooks: SpinHooks,
  rng: Rng = Math.random,
): Animator {
  const laid = layout(cfg.slices);
  let rotation = 0;
  let spinning = false;

  const spin = (): void => {
    if (spinning) return;
    spinning = true;
    hooks.onStart?.();

    const restAngle = pickRestAngle(rng);
    const spins = pickSpins(rng);
    rotation = nextRotation(rotation, restAngle, spins);

    dom.wheel.style.transition = `transform ${cfg.spinDurationSec}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
    // Force a layout flush so the transition has a committed "from" state before the rotation
    // changes; otherwise a wheel that hasn't painted yet (transition + new value set in the
    // same task) can skip straight to the end value instead of animating.
    void dom.wheel.offsetHeight;
    dom.setRotation(rotation);

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      spinning = false;
      clearTimeout(timer);
      dom.wheel.removeEventListener("transitionend", finish);
      hooks.onResult(resolveLanding(laid, restAngle, { magnetism: cfg.magnetism, seamBandDeg: cfg.seamBandDeg }));
    };
    dom.wheel.addEventListener("transitionend", finish, { once: true });
    const timer = setTimeout(finish, cfg.spinDurationSec * 1000 + SETTLE_GRACE_MS);
    if (hooks.onTick) driveTicks(dom.wheel, laid.length, hooks.onTick, () => done);
  };

  return { spin, isSpinning: () => spinning };
}
