import { weight, sliceIndex, type Weight, type SliceIndex } from "../model/units.js";
import type { ConfigError, Parsed } from "./errors.js";

export interface Slice {
  index: SliceIndex;
  text: string;
  weight: Weight;
}

const WEIGHT_RE = /\[\s*([0-9]*\.?[0-9]+)\s*%?\s*\]\s*$/;
const DEFAULT_WEIGHT = 1; // an entry without a bracket carries unit weight

export function parseSliceList(raw: string): Parsed<Slice[]> {
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return { kind: "error", errors: [{ kind: "empty-slice-list" }] };

  const errors: ConfigError[] = [];
  const slices: Slice[] = [];
  parts.forEach((entry, i) => {
    const m = WEIGHT_RE.exec(entry);
    let w = DEFAULT_WEIGHT;
    let text = entry;
    if (m) {
      const parsed = Number(m[1]);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        errors.push({ kind: "bad-weight", entry, raw: m[1]! });
        return;
      }
      w = parsed;
      text = entry.slice(0, m.index).trim();
    } else if (/\[[^\]]*\]\s*$/.test(entry)) {
      // A bracket that did not match a positive number is malformed, not text.
      errors.push({ kind: "bad-weight", entry, raw: entry });
      return;
    }
    slices.push({ index: sliceIndex(i), text, weight: weight(w) });
  });

  if (errors.length > 0) return { kind: "error", errors };
  return { kind: "ok", value: slices };
}
