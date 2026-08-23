import { parseSliceList, type Slice } from "./slices.js";
import type { ConfigError, Parsed } from "./errors.js";
import { deg, type Degrees } from "../model/units.js";
import type { FieldData } from "../se/types.js";
import { resolveScheme, type ColorScheme } from "./schemes.js";

export type WheelStyle = "halfwheel" | "fullwheel";

export interface WheelConfig {
  scale: number;
  style: WheelStyle;
  title: string;
  slices: Slice[];
  spinDurationSec: number;
  countdownSec: number;
  countdownText: string;
  spinningText: string;
  magnetism: boolean;
  seamBandDeg: Degrees;
  respinText: string;
  scheme: ColorScheme;
  centerIcon: string;
  winSound: string | undefined;
  tickSound: string | undefined;
  disableConfetti: boolean;
}

const str = (v: unknown, dflt: string): string => (typeof v === "string" ? v : dflt);
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === "boolean" ? v : dflt);
// Empty string is "no value" for optional text/sound fields; never store "".
const opt = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

export function parseConfig(fieldData: FieldData): Parsed<WheelConfig> {
  const errors: ConfigError[] = [];

  if (fieldData.sliceEntries === undefined) {
    errors.push({ kind: "missing-field", key: "sliceEntries" });
  }
  let slices: Slice[] = [];
  if (typeof fieldData.sliceEntries === "string") {
    const parsed = parseSliceList(fieldData.sliceEntries);
    if (parsed.kind === "error") errors.push(...parsed.errors);
    else slices = parsed.value;
  }

  if (errors.length > 0) return { kind: "error", errors };

  const style: WheelStyle = fieldData.wheelStyle === "fullwheel" ? "fullwheel" : "halfwheel";

  return {
    kind: "ok",
    value: {
      scale: num(fieldData.scaleWidget, 1),
      style,
      title: str(fieldData.wheelTitle, ""),
      slices,
      spinDurationSec: num(fieldData.spinDuration, 5),
      countdownSec: num(fieldData.countdownTime, 3),
      countdownText: str(fieldData.countdownText, "Spinning in... {countdown}"),
      spinningText: str(fieldData.spinningText, "Spinning"),
      magnetism: bool(fieldData.magnetism, false), // schema default: raw landing
      seamBandDeg: deg(num(fieldData.seamBand, 3)), // schema default: 3 deg half-band
      respinText: str(fieldData.respinText, "On the line -- spin again"),
      scheme: resolveScheme(fieldData),
      centerIcon: str(fieldData.centerIcon, "heart"),
      winSound: opt(fieldData.soundWin),
      tickSound: opt(fieldData.soundTick),
      disableConfetti: bool(fieldData.disableConfetti, false),
    },
  };
}
