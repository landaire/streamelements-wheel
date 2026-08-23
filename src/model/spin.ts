import { deg, normalizeDeg, type Degrees, type SliceIndex } from "./units.js";
import { sliceAtAngle, sliceCenterDeg, nearestSeam, type SliceLayout } from "./geometry.js";

export type Rng = () => number;

export interface LandingConfig {
  magnetism: boolean;
  seamBandDeg: Degrees;
}

export type SpinResult =
  | { kind: "winner"; slice: SliceIndex; restAngle: Degrees }
  | { kind: "seam"; between: [SliceIndex, SliceIndex]; restAngle: Degrees };

// Normalized spin impulse in [0,1]: 0 = a light spin (few turns, settles early), 1 = a
// hard spin (more turns, keeps speed deep into the fixed duration, then stops).
export type Force = number & { readonly __brand: "Force" };

// Full rotations at the extremes of force. The duration is fixed, so more turns is a
// visibly faster spin. Integer-valued because nextRotation only lands on the target when
// the added turns are whole (a fractional turn shifts the resting pointer angle).
export const SPIN_TURNS_MIN = 4; // full rotations at force 0
export const SPIN_TURNS_MAX = 8; // full rotations at force 1

// The forward-pull deceleration curve is chosen from a fixed set of ease-out timing
// functions defined statically in wheel.css as @keyframes wheel-spin-0..N. They run from a
// calm settle (bucket 0: ~95% of travel done by 60% of the duration) to a suspenseful late
// stop (bucket N: only ~76% done by then, so the wheel keeps moving into the final stretch).
// The buckets are static because a per-keyframe animation-timing-function does not resolve a
// CSS custom property, so the curve cannot be passed in as a var at spin time.
export const FORCE_BUCKETS = 5;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// Force centered on 0.5, spread by variance in [0,1]: variance 0 makes every spin
// identical (0.5); variance 1 spans the full [0,1] range.
export function pickForce(rng: Rng, variance: number): Force {
  const v = clamp01(variance);
  return clamp01(0.5 + (rng() - 0.5) * v) as Force;
}

export function spinTurns(force: Force): number {
  return Math.round(SPIN_TURNS_MIN + force * (SPIN_TURNS_MAX - SPIN_TURNS_MIN));
}

// The wheel-spin-<n> keyframe rule to animate with: higher force picks a later-decelerating
// (more suspenseful) curve.
export function forceBucket(force: Force): number {
  return Math.round(clamp01(force) * (FORCE_BUCKETS - 1));
}

export function pickRestAngle(rng: Rng): Degrees {
  return deg(rng() * 360);
}

export function resolveLanding(
  layout: readonly SliceLayout[],
  restAngle: Degrees,
  cfg: LandingConfig,
): SpinResult {
  const slice = sliceAtAngle(layout, restAngle);
  if (cfg.magnetism) {
    const l = layout.find((x) => x.index === slice)!; // slice always comes from sliceAtAngle on this layout, so find succeeds

    return { kind: "winner", slice, restAngle: sliceCenterDeg(l) };
  }
  // With magnetism off, each slice loses 2*seamBandDeg of winning arc at its two edges,
  // so small slices are proportionally deweighted among winners. A slice whose arc <=
  // 2*seamBandDeg is never winnable with magnetism off (always resolves to seam).
  // Phase 2 config validation will warn when 2*seamBandDeg >= the smallest slice arc.
  const seam = nearestSeam(layout, restAngle);
  if ((seam.dist as number) <= (cfg.seamBandDeg as number)) {
    // Snap the resting angle exactly onto the boundary so "on the line" is literally true:
    // the pointer comes to rest on the seam between the two slices, not merely near it.
    return { kind: "seam", between: seam.between, restAngle: seam.seam };
  }
  return { kind: "winner", slice, restAngle: normalizeDeg(restAngle) };
}

export function nextRotation(currentDeg: number, restAngle: Degrees, spins: number): number {
  // pointer degree = normalize(90 - rotation); solve rotation for the requested rest angle.
  const targetMod = (((90 - (restAngle as number)) % 360) + 360) % 360;
  const curMod = ((currentDeg % 360) + 360) % 360;
  let delta = targetMod - curMod;
  if (delta < 0) delta += 360;
  return currentDeg + spins * 360 + delta;
}
