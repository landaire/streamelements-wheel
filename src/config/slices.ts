import { weight, sliceIndex, type Weight, type SliceIndex } from "../model/units.js";
import type { ConfigError, Parsed } from "./errors.js";

export interface Slice {
  index: SliceIndex;
  text: string;
  weight: Weight;
  color?: string; // set only by the advanced category path; sliceEntries slices leave it undefined
}

// percent: entry had [n%]; relative: entry had [n] with no %; default: no bracket at all.
export type WeightKind = "percent" | "relative" | "default";

export interface SliceEntry {
  index: SliceIndex;
  text: string;
  kind: WeightKind;
  // Raw number as entered: the percent value for "percent", the relative number for
  // "relative", or DEFAULT_WEIGHT for "default". Resolution into final slice shares
  // happens in resolveWeights, once normalizeWeights (a config-level choice) is known.
  rawWeight: number;
}

const WEIGHT_RE = /\[\s*([0-9]*\.?[0-9]+)\s*(%)?\s*\]\s*$/;
const DEFAULT_WEIGHT = 1; // an entry without a bracket carries unit weight
// keeps an entry with a computed 0% share visible instead of degenerate; also reused
// by config/advanced.ts for the same reason on the category-weighted path.
export const EPSILON_WEIGHT = 0.0001;

export function parseSliceList(raw: string): Parsed<SliceEntry[]> {
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return { kind: "error", errors: [{ kind: "empty-slice-list" }] };

  const errors: ConfigError[] = [];
  const entries: SliceEntry[] = [];
  parts.forEach((entry, i) => {
    const m = WEIGHT_RE.exec(entry);
    let kind: WeightKind = "default";
    let rawWeight = DEFAULT_WEIGHT;
    let text = entry;
    if (m) {
      const parsed = Number(m[1]);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        errors.push({ kind: "bad-weight", entry, raw: m[1]! });
        return;
      }
      kind = m[2] === "%" ? "percent" : "relative";
      rawWeight = parsed;
      text = entry.slice(0, m.index).trim();
    } else if (/\[[^\]]*\]\s*$/.test(entry)) {
      // A bracket that did not match a positive number is malformed, not text.
      errors.push({ kind: "bad-weight", entry, raw: entry });
      return;
    }
    entries.push({ index: sliceIndex(i), text, kind, rawWeight });
  });

  if (errors.length > 0) return { kind: "error", errors };
  return { kind: "ok", value: entries };
}

// Resolves parsed slice entries into final geometry weights.
//
// Compat mode (normalizeWeights true): the original spinner's behavior. Every [n] and
// [n%] is a relative weight, default = 1; geometry.layout() normalizes by the total,
// so percent and plain entries are treated identically.
//
// Absolute mode (normalizeWeights false, default): percent entries claim that exact
// share of the wheel (scaled down proportionally if they sum past 100). Non-percent
// entries (relative or default) split whatever share remains, in proportion to their
// relative value. If there are no non-percent entries and the percents do not reach
// 100, the percents are normalized among themselves instead of leaving a gap.
export function resolveWeights(entries: readonly SliceEntry[], normalizeWeights: boolean): Slice[] {
  if (normalizeWeights) {
    return entries.map((e) => ({ index: e.index, text: e.text, weight: weight(e.rawWeight) }));
  }

  const percentEntries = entries.filter((e) => e.kind === "percent");
  const nonPercentEntries = entries.filter((e) => e.kind !== "percent");
  const totalPercent = percentEntries.reduce((sum, e) => sum + e.rawWeight, 0);

  const shares = new Map<SliceIndex, number>();

  if (nonPercentEntries.length === 0 && totalPercent < 100) {
    // Nothing to absorb the remainder: normalize the percents to fill the wheel.
    for (const e of percentEntries) {
      shares.set(e.index, totalPercent > 0 ? (e.rawWeight / totalPercent) * 100 : 100 / percentEntries.length);
    }
  } else {
    const scale = totalPercent > 100 ? 100 / totalPercent : 1;
    const remaining = Math.max(0, 100 - Math.min(totalPercent, 100));
    const relativeTotal = nonPercentEntries.reduce((sum, e) => sum + e.rawWeight, 0);
    for (const e of percentEntries) shares.set(e.index, e.rawWeight * scale);
    for (const e of nonPercentEntries) {
      shares.set(e.index, relativeTotal > 0 ? remaining * (e.rawWeight / relativeTotal) : 0);
    }
  }

  return entries.map((e) => {
    const share = shares.get(e.index) ?? 0;
    return { index: e.index, text: e.text, weight: weight(share > 0 ? share : EPSILON_WEIGHT) };
  });
}
