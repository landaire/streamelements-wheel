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
}

export interface Animator {
  spin(): void;
  isSpinning(): boolean;
}

const SETTLE_GRACE_MS = 50; // fallback past transitionend for headless environments

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
  };

  return { spin, isSpinning: () => spinning };
}
