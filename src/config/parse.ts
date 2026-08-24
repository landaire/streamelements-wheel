import { parseSliceList, resolveWeights, type Slice } from "./slices.js";
import { parseAdvancedConfig, resolveAdvancedWeights } from "./advanced.js";
import type { ConfigError, Parsed } from "./errors.js";
import { deg, type Degrees } from "../model/units.js";
import type { FieldData } from "../se/types.js";
import { resolveScheme, type ColorScheme } from "./schemes.js";
import { FIELD_DEFAULTS } from "./fields.js";

export type WheelStyle = "halfwheel" | "fullwheel";
export type HubMode = "icon" | "image" | "text";
export type HubTextStyle = "fit" | "curve";
export type CommandPermission = "mods" | "broadcaster";
export type AddEntrySource = "input" | "username";

export interface WheelConfig {
  scale: number;
  style: WheelStyle;
  title: string;
  fontFamily: string;
  slices: Slice[];
  spinDurationSec: number;
  countdownSec: number;
  countdownText: string;
  spinningText: string;
  magnetism: boolean;
  seamBandDeg: Degrees;
  spinForceVariance: number; // 0..1: how much spin force (turns + decel curve) varies per spin
  respinText: string;
  spinCommand: string;
  scheme: ColorScheme;
  centerIcon: string;
  hubMode: HubMode;
  hubImage: string;
  hubText: string;
  hubTextStyle: HubTextStyle;
  winSound: string | undefined;
  tickSound: string | undefined;
  seamSound: string | undefined;
  disableConfetti: boolean;
  normalizeWeights: boolean;
  disableSound: boolean;
  disableTickSound: boolean;
  enableCommands: boolean;
  wheelCommand: string;
  commandPermission: CommandPermission;
  enableAddEntryReward: boolean;
  addEntryRewardName: string;
  addEntrySource: AddEntrySource;
  addEntryMax: number; // 0 = unlimited
  addEntryOnePerUser: boolean;
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

  const normalizeWeights = bool(fieldData.normalizeWeights, FIELD_DEFAULTS.normalizeWeights as boolean);
  const advancedConfigRaw = str(fieldData.advancedConfig, FIELD_DEFAULTS.advancedConfig as string).trim();

  if (advancedConfigRaw.length > 0) {
    // advancedConfig, when set, replaces the simple slice list entirely.
    const parsedAdvanced = parseAdvancedConfig(advancedConfigRaw);
    if (parsedAdvanced.kind === "error") errors.push(...parsedAdvanced.errors);
    else slices = resolveAdvancedWeights(parsedAdvanced.value);
  } else if (fieldData.sliceEntries === undefined) {
    errors.push({ kind: "missing-field", key: "sliceEntries" });
  } else if (typeof fieldData.sliceEntries === "string") {
    const parsed = parseSliceList(fieldData.sliceEntries);
    if (parsed.kind === "error") errors.push(...parsed.errors);
    else slices = resolveWeights(parsed.value, normalizeWeights);
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

  const hubMode: HubMode =
    fieldData.hubMode === "image"
      ? "image"
      : fieldData.hubMode === "text"
        ? "text"
        : fieldData.hubMode === "icon"
          ? "icon"
          : (FIELD_DEFAULTS.hubMode as HubMode);

  const hubTextStyle: HubTextStyle =
    fieldData.hubTextStyle === "curve"
      ? "curve"
      : fieldData.hubTextStyle === "fit"
        ? "fit"
        : (FIELD_DEFAULTS.hubTextStyle as HubTextStyle);

  const commandPermission: CommandPermission =
    fieldData.commandPermission === "broadcaster"
      ? "broadcaster"
      : fieldData.commandPermission === "mods"
        ? "mods"
        : (FIELD_DEFAULTS.commandPermission as CommandPermission);

  const addEntrySource: AddEntrySource =
    fieldData.addEntrySource === "username"
      ? "username"
      : fieldData.addEntrySource === "input"
        ? "input"
        : (FIELD_DEFAULTS.addEntrySource as AddEntrySource);

  // Defaults sourced from FIELD_DEFAULTS (src/config/fields.ts), the single source of
  // truth also used to generate the widget's fields.json schema.
  return {
    kind: "ok",
    value: {
      scale: num(fieldData.scaleWidget, FIELD_DEFAULTS.scaleWidget as number),
      style,
      title: str(fieldData.wheelTitle, FIELD_DEFAULTS.wheelTitle as string),
      fontFamily: str(fieldData.fontFamily, FIELD_DEFAULTS.fontFamily as string).trim(),
      slices,
      spinDurationSec: num(fieldData.spinDuration, FIELD_DEFAULTS.spinDuration as number),
      countdownSec: num(fieldData.countdownTime, FIELD_DEFAULTS.countdownTime as number),
      countdownText: str(fieldData.countdownText, FIELD_DEFAULTS.countdownText as string),
      spinningText: str(fieldData.spinningText, FIELD_DEFAULTS.spinningText as string),
      magnetism: bool(fieldData.magnetism, FIELD_DEFAULTS.magnetism as boolean),
      seamBandDeg: deg(num(fieldData.seamBand, FIELD_DEFAULTS.seamBand as number)),
      spinForceVariance: Math.max(0, Math.min(1, num(fieldData.spinForceVariance, FIELD_DEFAULTS.spinForceVariance as number))),
      respinText: str(fieldData.respinText, FIELD_DEFAULTS.respinText as string),
      spinCommand: str(fieldData.spinCommand, FIELD_DEFAULTS.spinCommand as string),
      scheme: resolveScheme(fieldData),
      centerIcon: str(fieldData.centerIcon, FIELD_DEFAULTS.centerIcon as string),
      hubMode,
      hubImage: str(fieldData.hubImage, FIELD_DEFAULTS.hubImage as string),
      hubText: str(fieldData.hubText, FIELD_DEFAULTS.hubText as string),
      hubTextStyle,
      winSound: opt(fieldData.soundWin),
      tickSound: opt(fieldData.soundTick),
      seamSound: opt(fieldData.soundSeam),
      disableConfetti: bool(fieldData.disableConfetti, FIELD_DEFAULTS.disableConfetti as boolean),
      normalizeWeights,
      disableSound: bool(fieldData.disableSound, FIELD_DEFAULTS.disableSound as boolean),
      disableTickSound: bool(fieldData.disableTickSound, FIELD_DEFAULTS.disableTickSound as boolean),
      enableCommands: bool(fieldData.enableCommands, FIELD_DEFAULTS.enableCommands as boolean),
      wheelCommand: str(fieldData.wheelCommand, FIELD_DEFAULTS.wheelCommand as string),
      commandPermission,
      enableAddEntryReward: bool(fieldData.enableAddEntryReward, FIELD_DEFAULTS.enableAddEntryReward as boolean),
      addEntryRewardName: str(fieldData.addEntryRewardName, FIELD_DEFAULTS.addEntryRewardName as string),
      addEntrySource,
      addEntryMax: num(fieldData.addEntryMax, FIELD_DEFAULTS.addEntryMax as number),
      addEntryOnePerUser: bool(fieldData.addEntryOnePerUser, FIELD_DEFAULTS.addEntryOnePerUser as boolean),
    },
  };
}
