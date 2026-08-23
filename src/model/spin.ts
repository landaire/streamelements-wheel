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

export const SPIN_TURNS_MIN = 5; // full rotations before settling: enough to read as a real spin
export const SPIN_TURNS_MAX = 7;

export function pickSpins(rng: Rng): number {
  const span = SPIN_TURNS_MAX - SPIN_TURNS_MIN + 1;
  return SPIN_TURNS_MIN + Math.floor(rng() * span);
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
    return { kind: "seam", between: seam.between, restAngle: normalizeDeg(restAngle) };
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
