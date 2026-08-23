import { parseSliceList, type Slice } from "./slices.js";
import type { ConfigError, Parsed } from "./errors.js";
import { deg, type Degrees } from "../model/units.js";
import type { FieldData } from "../se/types.js";
import { resolveScheme, type ColorScheme } from "./schemes.js";
import { FIELD_DEFAULTS } from "./fields.js";

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
  spinCommand: string;
  scheme: ColorScheme;
  centerIcon: string;
  winSound: string | undefined;
  tickSound: string | undefined;
  disableConfetti: boolean;
}

const str = (v: unknown, dflt: string): string => (typeof v === "string" ? v : dflt);
// SE may deliver number/slider fields as strings; coerce rather than drop the streamer's value.
const num = (v: unknown, dflt: number): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0 && Number.isFinite(Number(v.trim()))) return Number(v.trim());
  return dflt;
};
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === "boolean" ? v : dflt);
// Empty string is "no value" for optional text/sound fields; never store "".
const opt = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

export function parseConfig(fieldData: FieldData): Parsed<WheelConfig> {
  const errors: ConfigError[] = [];
  let slices: Slice[] = [];

  if (fieldData.sliceEntries === undefined) {
    errors.push({ kind: "missing-field", key: "sliceEntries" });
  } else if (typeof fieldData.sliceEntries === "string") {
    const parsed = parseSliceList(fieldData.sliceEntries);
    if (parsed.kind === "error") errors.push(...parsed.errors);
    else slices = parsed.value;
  } else {
    errors.push({ kind: "bad-field-type", key: "sliceEntries" });
  }

  if (errors.length > 0) return { kind: "error", errors };

  const style: WheelStyle =
    fieldData.wheelStyle === "fullwheel"
      ? "fullwheel"
      : fieldData.wheelStyle === "halfwheel"
        ? "halfwheel"
        : (FIELD_DEFAULTS.wheelStyle as WheelStyle);

  // Defaults sourced from FIELD_DEFAULTS (src/config/fields.ts), the single source of
  // truth also used to generate the widget's fields.json schema.
  return {
    kind: "ok",
    value: {
      scale: num(fieldData.scaleWidget, FIELD_DEFAULTS.scaleWidget as number),
      style,
      title: str(fieldData.wheelTitle, FIELD_DEFAULTS.wheelTitle as string),
      slices,
      spinDurationSec: num(fieldData.spinDuration, FIELD_DEFAULTS.spinDuration as number),
      countdownSec: num(fieldData.countdownTime, FIELD_DEFAULTS.countdownTime as number),
      countdownText: str(fieldData.countdownText, FIELD_DEFAULTS.countdownText as string),
      spinningText: str(fieldData.spinningText, FIELD_DEFAULTS.spinningText as string),
      magnetism: bool(fieldData.magnetism, FIELD_DEFAULTS.magnetism as boolean),
      seamBandDeg: deg(num(fieldData.seamBand, FIELD_DEFAULTS.seamBand as number)),
      respinText: str(fieldData.respinText, FIELD_DEFAULTS.respinText as string),
      spinCommand: str(fieldData.spinCommand, FIELD_DEFAULTS.spinCommand as string),
      scheme: resolveScheme(fieldData),
      centerIcon: str(fieldData.centerIcon, FIELD_DEFAULTS.centerIcon as string),
      winSound: opt(fieldData.soundWin),
      tickSound: opt(fieldData.soundTick),
      disableConfetti: bool(fieldData.disableConfetti, FIELD_DEFAULTS.disableConfetti as boolean),
    },
  };
}
