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
  const prev = layouts[(bi - 1 + n) % n]!.index; // slice ending at this seam
  const next = layouts[bi]!.index; // slice starting at this seam
  const seam = normalizeDeg(deg((layouts[bi]!.startTurn as number) * 360));
  return { dist: deg(best), between: [prev, next], seam };
}
