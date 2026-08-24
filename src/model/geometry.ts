import { deg, turns, normalizeDeg, type Degrees, type Turns, type SliceIndex } from "./units.js";
import type { Slice } from "../config/slices.js";

export interface SliceLayout {
  index: SliceIndex;
  startTurn: Turns;
  sizeTurn: Turns;
}

export function layout(slices: readonly Slice[]): SliceLayout[] {
  // total > 0: the parser rejects empty lists and every weight is positive.
  let total = 0;
  for (const s of slices) total += s.weight as number;
  const out: SliceLayout[] = [];
  let cursor = 0;
  for (const s of slices) {
    const size = (s.weight as number) / total;
    out.push({ index: s.index, startTurn: turns(cursor), sizeTurn: turns(size) });
    cursor += size;
  }
  return out;
}

export function sliceCenterDeg(l: SliceLayout): Degrees {
  return normalizeDeg(deg(((l.startTurn as number) + (l.sizeTurn as number) / 2) * 360));
}

export function sliceAtAngle(layouts: readonly SliceLayout[], d: Degrees): SliceIndex {
  const a = normalizeDeg(d) as number;
  for (const l of layouts) {
    const start = (l.startTurn as number) * 360;
    const end = start + (l.sizeTurn as number) * 360;
    if (a >= start && a < end) return l.index;
  }
  // Floating point can put a at exactly 360; the final slice owns the wrap point.
  return layouts[layouts.length - 1]!.index;
}

export interface SeamInfo {
  dist: Degrees;
  between: [SliceIndex, SliceIndex];
  seam: Degrees; // the boundary angle itself, so a seam landing can snap exactly onto the line
  prevSizeTurn: Turns; // arc of the slice ending at this seam
  nextSizeTurn: Turns; // arc of the slice starting at this seam
}

export function nearestSeam(layouts: readonly SliceLayout[], d: Degrees): SeamInfo {
  const a = normalizeDeg(d) as number;
  const n = layouts.length;
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < n; i++) {
    const seam = (layouts[i]!.startTurn as number) * 360; // boundary before slice i
    let dd = Math.abs(a - seam);
    dd = Math.min(dd, 360 - dd);
    if (dd < best) {
      best = dd;
      bi = i;
    }
  }
  const prevL = layouts[(bi - 1 + n) % n]!; // slice ending at this seam
  const nextL = layouts[bi]!; // slice starting at this seam
  const seam = normalizeDeg(deg((nextL.startTurn as number) * 360));
  return { dist: deg(best), between: [prevL.index, nextL.index], seam, prevSizeTurn: prevL.sizeTurn, nextSizeTurn: nextL.sizeTurn };
}

// Largest share of the smaller adjacent slice a single seam's band may claim on each side.
// A slice touches two seams, so 2 x this <= 0.7 leaves every slice at least ~30% of its arc
// winnable -- a hair-thin slice can never be swallowed whole by its two seam zones.
export const MAX_SEAM_FRACTION = 0.35;

// The seam band actually applied at one boundary: the configured band, capped so it never
// consumes more than MAX_SEAM_FRACTION of the smaller neighbouring slice. On normal wheels
// the cap never bites; it only shrinks the band around unusually thin slices.
export function effectiveSeamBandDeg(prevSizeTurn: Turns, nextSizeTurn: Turns, configuredBandDeg: number): number {
  const smallerArcDeg = Math.min(prevSizeTurn as number, nextSizeTurn as number) * 360;
  return Math.min(configuredBandDeg, MAX_SEAM_FRACTION * smallerArcDeg);
}
