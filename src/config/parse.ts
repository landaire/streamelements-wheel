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
export type CommandPermission = "broadcaster" | "leadmods" | "mods";
export type SeamResult = "respin" | "both";
export type AddEntrySource = "input" | "username";

export interface WheelConfig {
  scale: number;
  style: WheelStyle;
  title: string;
  titleFontSize: number; // px
  titleGap: number; // px gap between the title pill and the wheel top
  fontFamily: string;
  labelSizeMax: number; // largest slice-label font size (base px)
  labelSizeMin: number; // smallest slice-label font size (base px)
  slices: Slice[];
  spinDurationSec: number;
  countdownSec: number;
  countdownText: string;
  spinningText: string;
  slotMachineTitle: boolean;
  magnetism: boolean;
  seamBandDeg: Degrees;
  showSeamZone: boolean; // overlay the on-the-line zone bands (preview aid)
  spinForceVariance: number; // 0..1: how much spin force (turns + decel curve) varies per spin
  seamResult: SeamResult; // magnetism-off: "respin" (on the line) or "both" adjacent slices win
  seamCombine: boolean; // sum matching numbered groups from both options instead of quoting
  seamJoinText: string; // placed between the two options when "both" win
  respinText: string;
  spinCommand: string;
  scheme: ColorScheme;
  centerIcon: string;
  hubMode: HubMode;
  hubSize: number; // hub diameter as a percent of the wheel
  hubImage: string;
  hubImageFill: boolean; // cover the hub out to the border vs inset with the rim showing
  hubImageUnlocked: boolean; // free placement: translate arbitrarily (may clip) vs coverage-preserving
  hubImageZoom: number; // scale factor >= 1 applied to the hub image
  hubImageOffsetX: number; // 50 = centered; locked reads it as object-position %, free as a translate %
  hubImageOffsetY: number;
  hubText: string;
  hubTextStyle: HubTextStyle;
  winSound: string | undefined;
  tickSound: string | undefined;
  seamSound: string | undefined;
  winVolume: number; // 0..1 per-sound level
  tickVolume: number;
  seamVolume: number;
  winSoundStyle: string; // "chime" | "cash": which synthesized win sound to use

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
// A 0..100 percent field coerced to a clamped 0..1 gain.
const pct01 = (v: unknown, dfltPct: number): number => Math.max(0, Math.min(1, num(v, dfltPct) / 100));
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
  } else {
    // Back-compat: a missing or blank sliceEntries falls back to the default list so an old
    // or partial config always renders, never hard-erroring on an absent field.
    const rawSlices = str(fieldData.sliceEntries, "").trim();
    const sliceText = rawSlices.length > 0 ? rawSlices : (FIELD_DEFAULTS.sliceEntries as string);
    const parsed = parseSliceList(sliceText);
    if (parsed.kind === "error") errors.push(...parsed.errors);
    else slices = resolveWeights(parsed.value, normalizeWeights);
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
      : fieldData.commandPermission === "leadmods"
        ? "leadmods"
        : fieldData.commandPermission === "mods"
          ? "mods"
          : (FIELD_DEFAULTS.commandPermission as CommandPermission);

  const addEntrySource: AddEntrySource =
    fieldData.addEntrySource === "username"
      ? "username"
      : fieldData.addEntrySource === "input"
        ? "input"
        : (FIELD_DEFAULTS.addEntrySource as AddEntrySource);

  const labelSizeMax = Math.max(8, Math.min(120, num(fieldData.labelSizeMax, FIELD_DEFAULTS.labelSizeMax as number)));
  const labelSizeMin = Math.max(2, Math.min(labelSizeMax, num(fieldData.labelSizeMin, FIELD_DEFAULTS.labelSizeMin as number)));

  // Defaults sourced from FIELD_DEFAULTS (src/config/fields.ts), the single source of
  // truth also used to generate the widget's fields.json schema.
  return {
    kind: "ok",
    value: {
      scale: num(fieldData.scaleWidget, FIELD_DEFAULTS.scaleWidget as number),
      style,
      title: str(fieldData.wheelTitle, FIELD_DEFAULTS.wheelTitle as string),
      titleFontSize: Math.max(8, Math.min(40, num(fieldData.titleFontSize, FIELD_DEFAULTS.titleFontSize as number))),
      titleGap: Math.max(0, Math.min(60, num(fieldData.titleGap, FIELD_DEFAULTS.titleGap as number))),
      fontFamily: str(fieldData.fontFamily, FIELD_DEFAULTS.fontFamily as string).trim(),
      labelSizeMax,
      labelSizeMin,
      slices,
      spinDurationSec: num(fieldData.spinDuration, FIELD_DEFAULTS.spinDuration as number),
      countdownSec: num(fieldData.countdownTime, FIELD_DEFAULTS.countdownTime as number),
      countdownText: str(fieldData.countdownText, FIELD_DEFAULTS.countdownText as string),
      spinningText: str(fieldData.spinningText, FIELD_DEFAULTS.spinningText as string),
      slotMachineTitle: bool(fieldData.slotMachineTitle, FIELD_DEFAULTS.slotMachineTitle as boolean),
      magnetism: bool(fieldData.magnetism, FIELD_DEFAULTS.magnetism as boolean),
      seamBandDeg: deg(num(fieldData.seamBand, FIELD_DEFAULTS.seamBand as number)),
      showSeamZone: bool(fieldData.showSeamZone, FIELD_DEFAULTS.showSeamZone as boolean),
      spinForceVariance: Math.max(0, Math.min(1, num(fieldData.spinForceVariance, FIELD_DEFAULTS.spinForceVariance as number))),
      // Landing on the line counts as both slices winning by default; not a UI toggle.
      seamResult: fieldData.seamResult === "respin" ? "respin" : "both",
      seamCombine: bool(fieldData.seamCombine, FIELD_DEFAULTS.seamCombine as boolean),
      seamJoinText: str(fieldData.seamJoinText, FIELD_DEFAULTS.seamJoinText as string),
      respinText: str(fieldData.respinText, FIELD_DEFAULTS.respinText as string),
      spinCommand: str(fieldData.spinCommand, FIELD_DEFAULTS.spinCommand as string),
      scheme: resolveScheme(fieldData),
      centerIcon: str(fieldData.centerIcon, FIELD_DEFAULTS.centerIcon as string),
      hubMode,
      hubSize: Math.max(14, Math.min(50, num(fieldData.hubSize, FIELD_DEFAULTS.hubSize as number))),
      hubImage: str(fieldData.hubImage, FIELD_DEFAULTS.hubImage as string),
      hubImageFill: bool(fieldData.hubImageFill, FIELD_DEFAULTS.hubImageFill as boolean),
      hubImageUnlocked: bool(fieldData.hubImageUnlocked, FIELD_DEFAULTS.hubImageUnlocked as boolean),
      hubImageZoom: Math.max(1, Math.min(4, num(fieldData.hubImageZoom, FIELD_DEFAULTS.hubImageZoom as number) / 100)),
      // Wide range so free placement can slide the image mostly off the hub; locked render clamps to 0..100.
      hubImageOffsetX: Math.max(-200, Math.min(300, num(fieldData.hubImageOffsetX, FIELD_DEFAULTS.hubImageOffsetX as number))),
      hubImageOffsetY: Math.max(-200, Math.min(300, num(fieldData.hubImageOffsetY, FIELD_DEFAULTS.hubImageOffsetY as number))),
      hubText: str(fieldData.hubText, FIELD_DEFAULTS.hubText as string),
      hubTextStyle,
      winSound: opt(fieldData.soundWin),
      tickSound: opt(fieldData.soundTick),
      seamSound: opt(fieldData.soundSeam),
      winVolume: pct01(fieldData.volumeWin, FIELD_DEFAULTS.volumeWin as number),
      tickVolume: pct01(fieldData.volumeTick, FIELD_DEFAULTS.volumeTick as number),
      seamVolume: pct01(fieldData.volumeSeam, FIELD_DEFAULTS.volumeSeam as number),
      winSoundStyle: fieldData.winSoundStyle === "cash" ? "cash" : "chime",
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
