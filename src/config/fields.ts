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
  { key: "spinDuration", type: "number", label: "Spin duration (s)", value: 5, group: "Wheel Settings" },
  { key: "countdownTime", type: "number", label: "Countdown (s, 0 = instant)", value: 3, group: "Wheel Settings" },
  { key: "countdownText", type: "text", label: "Countdown text", value: "Spinning in... {countdown}", group: "Wheel Settings" },
  { key: "spinningText", type: "text", label: "Spinning text", value: "Spinning", group: "Wheel Settings" },
  { key: "magnetism", type: "checkbox", label: "Magnetism (snap to slice center)", value: false, group: "Spin Behavior" },
  { key: "seamBand", type: "number", label: "Seam band (deg, half-width)", value: 3, group: "Spin Behavior" },
  { key: "respinText", type: "text", label: "Seam re-spin text", value: "On the line -- spin again", group: "Spin Behavior" },
  { key: "spinCommand", type: "text", label: "Chat command to spin (broadcaster/mods)", value: "!spin", group: "Spin Behavior" },
  { key: "colorScheme", type: "dropdown", label: "Color scheme", value: "sweetheart-original", options: { "sweetheart-original": "Sweetheart" }, group: "Colors" },
  { key: "centerIcon", type: "dropdown", label: "Center icon", value: "heart", options: { heart: "Heart", star: "Star", skull: "Skull", diamond: "Diamond" }, group: "Colors" },
  { key: "hubMode", type: "dropdown", label: "Hub content", value: "icon", options: { icon: "Icon", image: "Image", text: "Text" }, group: "Center Hub" },
  { key: "hubImage", type: "text", label: "Hub image URL", value: "", group: "Center Hub" },
  { key: "hubText", type: "text", label: "Hub text", value: "", group: "Center Hub" },
  { key: "hubTextStyle", type: "dropdown", label: "Hub text style", value: "fit", options: { fit: "Fit (block)", curve: "Curved" }, group: "Center Hub" },
  { key: "disableConfetti", type: "checkbox", label: "Disable confetti", value: false, group: "Confetti" },
  { key: "soundWin", type: "sound-input", label: "Win sound", value: "", group: "Sounds" },
  { key: "soundTick", type: "sound-input", label: "Tick sound", value: "", group: "Sounds" },
  { key: "disableSound", type: "checkbox", label: "Mute all sounds", value: false, group: "Sounds" },
  { key: "disableTickSound", type: "checkbox", label: "Disable tick sound", value: false, group: "Sounds" },
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
