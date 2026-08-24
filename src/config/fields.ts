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
  accept?: string; // playground only: file-input accept filter; presence adds a "Choose file"
  // button that encodes the picked file to a base64 data URL. Not serialized to fields.json.
  hidden?: boolean; // playground only: keep the value in the config but render no visible control
  // (driven by another affordance, e.g. dragging the hub image). Still emitted to fields.json.
}

export const FIELD_DEFS: readonly FieldDef[] = [
  { key: "importConfig", type: "text", label: "Import config code", value: "", group: "Import", hint: "Paste a config code (or the full share URL) and press Enter to load it into all the settings. In StreamElements this field applies the config directly." },
  { key: "scaleWidget", type: "slider", label: "Widget scale", value: 1, min: 0.5, max: 3, step: 0.1, group: "Wheel Settings" },
  { key: "wheelStyle", type: "dropdown", label: "Wheel style", value: "fullwheel", options: { halfwheel: "Half Wheel", fullwheel: "Full Wheel" }, group: "Wheel Settings" },
  { key: "wheelTitle", type: "text", label: "Title", value: "50 points to spin", group: "Wheel Settings" },
  { key: "fontFamily", type: "text", label: "Font", value: "Nunito", group: "Wheel Settings", hint: "Any Google Fonts family name (loaded automatically). Blank falls back to the system sans-serif." },
  { key: "labelSizeMax", type: "number", label: "Max label text size", value: 40, group: "Wheel Settings", hint: "The largest slice labels grow to (the default big size for short labels). Labels that do not fit at this size scale down." },
  { key: "labelSizeMin", type: "number", label: "Min label text size", value: 6, group: "Wheel Settings", hint: "The smallest slice labels shrink to before they simply overflow." },
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
  { key: "spinningText", type: "text", label: "Spinning text", value: "Spinning", group: "Wheel Settings", hint: "Shown in the title while spinning when the slot-machine roll is off." },
  { key: "slotMachineTitle", type: "checkbox", label: "Slot-machine title roll", value: true, group: "Wheel Settings", hint: "While spinning, roll the title through the options like a slot machine instead of showing the spinning text." },
  { key: "magnetism", type: "checkbox", label: "Magnetism (snap to slice center)", value: false, group: "Spin Behavior" },
  { key: "seamBand", type: "number", label: "On-the-line zone (deg)", value: 1, group: "Spin Behavior", hint: "Magnetism-off only: a landing within this many degrees of a boundary counts as 'on the line'. Smaller is rarer; roughly (slices x 2 x this)/360 of spins land on a line. Automatically narrowed around very thin slices so they always keep a winnable center." },
  { key: "showSeamZone", type: "checkbox", label: "Show on-the-line zone", value: false, group: "Spin Behavior", hint: "Overlay translucent bands on each boundary showing the on-the-line zone. Preview aid; leave off on stream." },
  { key: "spinForceVariance", type: "slider", label: "Spin force variance", value: 0.6, min: 0, max: 1, step: 0.05, group: "Spin Behavior", hint: "How much the spin force varies per spin. 0 = every spin feels identical; higher = some spins carry more momentum and keep going longer before they finally stop. Duration is unchanged." },
  { key: "seamCombine", type: "checkbox", label: "Combine on-the-line options", value: false, group: "Spin Behavior", hint: "Add matching numbered groups from both options, e.g. \"$10 + Spin\" and \"$20 + Spin\" become \"$30 + 2 Spin\". When off, both options are shown quoted." },
  { key: "seamJoinText", type: "text", label: "On-the-line join text", value: " + ", group: "Spin Behavior", hint: "Placed between the two options when they are shown quoted (combine off), e.g. \"A\" + \"B\"." },
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
  { key: "hubImage", type: "text", label: "Hub image URL", value: "", group: "Center Hub", accept: "image/*", hint: "Pick a file to embed it, or paste an image URL or a base64 data URL. Shown when Hub content = Image." },
  { key: "hubImageFill", type: "checkbox", label: "Fill hub to the border", value: true, group: "Center Hub", hint: "Cover the whole hub out to the rim. Off insets the image so the knob rim shows around it." },
  { key: "hubImageZoom", type: "slider", label: "Hub image zoom", value: 100, min: 100, max: 400, step: 5, group: "Center Hub", hint: "Zoom the hub image. Drag the image on the wheel preview to reposition it." },
  { key: "hubImageOffsetX", type: "number", label: "Hub image offset X", value: 50, group: "Center Hub", hidden: true },
  { key: "hubImageOffsetY", type: "number", label: "Hub image offset Y", value: 50, group: "Center Hub", hidden: true },
  { key: "hubText", type: "text", label: "Hub text", value: "", group: "Center Hub" },
  { key: "hubTextStyle", type: "dropdown", label: "Hub text style", value: "fit", options: { fit: "Fit (block)", curve: "Curved" }, group: "Center Hub" },
  { key: "disableConfetti", type: "checkbox", label: "Disable confetti", value: false, group: "Confetti" },
  { key: "winSoundStyle", type: "dropdown", label: "Win sound style", value: "chime", options: { chime: "Chime (celebratory bells)", cash: "Cash register (cha-ching)" }, group: "Sounds", hint: "The built-in synthesized win sound to play. Ignored if a Win sound URL is set below." },
  { key: "soundWin", type: "sound-input", label: "Win sound", value: "", group: "Sounds", accept: "audio/*", hint: "Overrides the built-in win sound. Pick a file to embed it, or paste a normal URL or a base64 data URL. Leave blank for the built-in." },
  { key: "soundTick", type: "sound-input", label: "Tick sound", value: "", group: "Sounds", accept: "audio/*", hint: "Overrides the built-in tick. Pick a file to embed it, or paste a normal URL or a base64 data URL. Leave blank for the built-in." },
  { key: "soundSeam", type: "sound-input", label: "On-the-line sound", value: "", group: "Sounds", accept: "audio/*", hint: "Plays on a seam landing (magnetism off). Pick a file to embed it, or paste a normal URL or a base64 data URL. Leave blank for the built-in." },
  { key: "volumeWin", type: "slider", label: "Win volume", value: 100, min: 0, max: 100, step: 5, group: "Sounds", hint: "Level of the win sound (built-in or your file)." },
  { key: "volumeTick", type: "slider", label: "Tick volume", value: 100, min: 0, max: 100, step: 5, group: "Sounds", hint: "Level of the per-slice tick." },
  { key: "volumeSeam", type: "slider", label: "On-the-line volume", value: 100, min: 0, max: 100, step: 5, group: "Sounds", hint: "Level of the on-the-line sound." },
  { key: "disableSound", type: "checkbox", label: "Mute all sounds", value: false, group: "Sounds" },
  { key: "disableTickSound", type: "checkbox", label: "Disable tick sound", value: false, group: "Sounds" },
  { key: "enableCommands", type: "checkbox", label: "Enable chat commands", value: true, group: "Commands" },
  { key: "wheelCommand", type: "text", label: "Base command", value: "!wheel", group: "Commands", hint: "Subcommands: spin, add <text>, remove <text>, reset, pause, resume, list." },
  { key: "commandPermission", type: "dropdown", label: "Command permission", value: "broadcaster", options: { broadcaster: "Broadcaster only", leadmods: "Broadcaster + lead moderators", mods: "Broadcaster + moderators" }, group: "Commands" },
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
