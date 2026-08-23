import type { FieldValue } from "../se/types.js";

export type FieldType = "text" | "number" | "checkbox" | "dropdown" | "slider" | "colorpicker" | "sound-input";

export interface FieldDef {
  key: string;
  type: FieldType;
  label: string;
  value: FieldValue; // default, round-trips to fields.json and to parse defaults
  group: string;
  options?: Record<string, string>;
  min?: number;
  max?: number;
  step?: number;
  hint?: string; // optional subtext shown under the control in the demo playground
}

export const FIELD_DEFS: readonly FieldDef[] = [
  { key: "scaleWidget", type: "slider", label: "Widget scale", value: 1, min: 0.5, max: 3, step: 0.1, group: "Wheel Settings" },
  { key: "wheelStyle", type: "dropdown", label: "Wheel style", value: "fullwheel", options: { halfwheel: "Half Wheel", fullwheel: "Full Wheel" }, group: "Wheel Settings" },
  { key: "wheelTitle", type: "text", label: "Title", value: "50 points to spin", group: "Wheel Settings" },
  { key: "sliceEntries", type: "text", label: "Slices (comma list, [n] or [n%] = weight)", value: "Eat a lemon, Song request [5%], Ranked games, Draw subs [10]", group: "Wheel Slices" },
  {
    key: "normalizeWeights",
    type: "checkbox",
    label: "Compatibility weight mode",
    value: false,
    group: "Wheel Slices",
    hint: "Original-spinner compatibility: treat [n] and [n%] as relative weights normalized to the total, instead of absolute percentages.",
  },
  {
    key: "advancedConfig",
    type: "text",
    label: "Advanced category config",
    value: "",
    group: "Wheel Slices",
    hint: "Advanced: JSON {categories, items}. When set, it replaces the simple slice list above.",
  },
  { key: "spinDuration", type: "number", label: "Spin duration (s)", value: 5, group: "Wheel Settings" },
  { key: "countdownTime", type: "number", label: "Countdown (s, 0 = instant)", value: 3, group: "Wheel Settings" },
  { key: "countdownText", type: "text", label: "Countdown text", value: "Spinning in... {countdown}", group: "Wheel Settings" },
  { key: "spinningText", type: "text", label: "Spinning text", value: "Spinning", group: "Wheel Settings" },
  { key: "magnetism", type: "checkbox", label: "Magnetism (snap to slice center)", value: false, group: "Spin Behavior" },
  { key: "seamBand", type: "number", label: "Seam tolerance (deg)", value: 1, group: "Spin Behavior", hint: "Magnetism-off only: a landing within this many degrees of a boundary counts as 'on the line' (spin again). Smaller is rarer; roughly (slices x 2 x this)/360 of spins land on a line." },
  { key: "respinText", type: "text", label: "Seam re-spin text", value: "On the line -- spin again", group: "Spin Behavior" },
  { key: "spinCommand", type: "text", label: "Chat command to spin (broadcaster/mods)", value: "!spin", group: "Spin Behavior" },
  { key: "colorScheme", type: "dropdown", label: "Color scheme", value: "auto", options: { auto: "Auto (from main colors)", grape: "Grape", fuchsia: "Fuchsia", "sweetheart-original": "Sweetheart", custom: "Custom (advanced)" }, group: "Colors", hint: "Auto derives the whole palette from the two main colors below. Custom exposes every individual color." },
  { key: "colorPrimary", type: "colorpicker", label: "Main color", value: "#8a4bd8", group: "Colors", hint: "Auto mode: drives the darker slices, border, rim, hub, and title." },
  { key: "colorSecondary", type: "colorpicker", label: "Secondary color", value: "#c9a8f0", group: "Colors", hint: "Auto mode: drives the lighter slices, title pill, and hub center." },
  { key: "centerIcon", type: "dropdown", label: "Center icon", value: "coin", options: { coin: "Coin", heart: "Heart", star: "Star", skull: "Skull", diamond: "Diamond" }, group: "Colors" },
  { key: "gemMatchScheme", type: "checkbox", label: "Gem matches color scheme", value: true, group: "Colors", hint: "The pointer gem derives its color from the palette. Uncheck to set a custom gem color." },
  { key: "colorGem", type: "colorpicker", label: "Gem color", value: "#8a4bd8", group: "Colors", hint: "Applies when 'Gem matches color scheme' is off." },
  { key: "colorSliceEven", type: "colorpicker", label: "Slice color A (darker)", value: "#ab4bb8", group: "Colors", hint: "Color pickers apply when Color scheme = Custom." },
  { key: "colorSliceOdd", type: "colorpicker", label: "Slice color B (lighter)", value: "#d9a9e8", group: "Colors" },
  { key: "colorSliceBorder", type: "colorpicker", label: "Slice border", value: "#8a3a97", group: "Colors" },
  { key: "colorRim", type: "colorpicker", label: "Outer rim", value: "#6f2f80", group: "Colors" },
  { key: "colorHub", type: "colorpicker", label: "Hub ring", value: "#6f2f80", group: "Colors" },
  { key: "colorHubInner", type: "colorpicker", label: "Hub center", value: "#ffe1f0", group: "Colors" },
  { key: "colorPlate", type: "colorpicker", label: "Title pill", value: "#e8c9f2", group: "Colors" },
  { key: "colorTitle", type: "colorpicker", label: "Title text", value: "#6f2f80", group: "Colors" },
  { key: "colorEntry", type: "colorpicker", label: "Label text", value: "#ffffff", group: "Colors" },
  { key: "hubMode", type: "dropdown", label: "Hub content", value: "icon", options: { icon: "Icon", image: "Image", text: "Text" }, group: "Center Hub" },
  { key: "hubImage", type: "text", label: "Hub image URL", value: "", group: "Center Hub" },
  { key: "hubText", type: "text", label: "Hub text", value: "", group: "Center Hub" },
  { key: "hubTextStyle", type: "dropdown", label: "Hub text style", value: "fit", options: { fit: "Fit (block)", curve: "Curved" }, group: "Center Hub" },
  { key: "disableConfetti", type: "checkbox", label: "Disable confetti", value: false, group: "Confetti" },
  { key: "soundWin", type: "sound-input", label: "Win sound", value: "", group: "Sounds" },
  { key: "soundTick", type: "sound-input", label: "Tick sound", value: "", group: "Sounds" },
  { key: "disableSound", type: "checkbox", label: "Mute all sounds", value: false, group: "Sounds" },
  { key: "disableTickSound", type: "checkbox", label: "Disable tick sound", value: false, group: "Sounds" },
  { key: "enableCommands", type: "checkbox", label: "Enable chat commands", value: true, group: "Commands" },
  { key: "wheelCommand", type: "text", label: "Base command", value: "!wheel", group: "Commands", hint: "Subcommands: spin, add <text>, remove <text>, reset, pause, resume, list." },
  { key: "commandPermission", type: "dropdown", label: "Command permission", value: "mods", options: { mods: "Broadcaster + Mods", broadcaster: "Broadcaster only" }, group: "Commands" },
  { key: "enableAddEntryReward", type: "checkbox", label: "Enable channel-point add-entry reward", value: false, group: "Channel Rewards" },
  { key: "addEntryRewardName", type: "text", label: "Reward name", value: "Add Wheel Entry", group: "Channel Rewards", hint: "Must match the channel-point reward's title exactly (case-insensitive)." },
  { key: "addEntrySource", type: "dropdown", label: "Entry source", value: "input", options: { input: "Redeemer's input text", username: "Redeemer's username" }, group: "Channel Rewards" },
  { key: "addEntryMax", type: "number", label: "Max added entries (0 = unlimited)", value: 0, group: "Channel Rewards" },
  { key: "addEntryOnePerUser", type: "checkbox", label: "One entry per user", value: true, group: "Channel Rewards" },
];

export const FIELD_DEFAULTS: Readonly<Record<string, FieldValue>> = Object.freeze(
  Object.fromEntries(FIELD_DEFS.map((f) => [f.key, f.value])),
);

// The StreamElements Fields schema object; serialized to fields.json at build.
export function buildFieldsSchema(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FIELD_DEFS) {
    const entry: Record<string, unknown> = { type: f.type, label: f.label, value: f.value, group: f.group };
    if (f.options) entry.options = f.options;
    if (f.min !== undefined) entry.min = f.min;
    if (f.max !== undefined) entry.max = f.max;
    if (f.step !== undefined) entry.step = f.step;
    out[f.key] = entry;
  }
  return out;
}
