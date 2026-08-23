import type { FieldData } from "../se/types.js";
import { FIELD_DEFAULTS } from "./fields.js";

export type ColorScheme =
  | { kind: "named"; name: string; vars: Record<string, string> }
  | { kind: "custom"; vars: Record<string, string> };

// Each named preset is a fixed set of the CSS custom properties the render reads.
const SCHEME_VARS: Readonly<Record<string, Record<string, string>>> = {
  grape: {
    "--slice-bg-even": "#ab4bb8",
    "--slice-bg-odd": "#d9a9e8",
    "--slice-border": "#8a3a97",
    "--centerpiece-bg": "#6f2f80",
    "--plate-bg": "#e8c9f2",
    "--title-color": "#6f2f80",
    "--entry-color": "#ffffff",
    "--rim-color": "#6f2f80",
  },
  fuchsia: {
    "--slice-bg-even": "#c42d9a",
    "--slice-bg-odd": "#f4a6ea",
    "--slice-border": "#8e1e70",
    "--centerpiece-bg": "#8a1a6d",
    "--plate-bg": "#ffdaf6",
    "--title-color": "#8a1a6d",
    "--entry-color": "#ffffff",
    "--rim-color": "#7a1560",
  },
  "sweetheart-original": {
    "--slice-bg-even": "#f8acba",
    "--slice-bg-odd": "#ffc2ce",
    "--slice-border": "#c76b7d",
    "--centerpiece-bg": "#b64e5f",
    "--plate-bg": "#ffe1e7",
    "--title-color": "#b64e5f",
    "--entry-color": "#ffffff",
    "--rim-color": "#8a3a48",
  },
};

const DEFAULT_SCHEME = FIELD_DEFAULTS.colorScheme as string;

// Custom-mode color-picker fields -> the CSS custom properties the render reads.
const CUSTOM_VAR_MAP: Readonly<Record<string, string>> = {
  colorSliceEven: "--slice-bg-even",
  colorSliceOdd: "--slice-bg-odd",
  colorSliceBorder: "--slice-border",
  colorRim: "--rim-color",
  colorHub: "--centerpiece-bg",
  colorHubInner: "--hub-inner",
  colorPlate: "--plate-bg",
  colorTitle: "--title-color",
  colorEntry: "--entry-color",
};

interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function parseHex(hex: string): { r: number; g: number; b: number } | undefined {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1]!;
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function hexToHsl(hex: string): Hsl | undefined {
  const rgb = parseHex(hex);
  if (!rgb) return undefined;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex(hsl: Hsl): string {
  const s = clamp01(hsl.s);
  const l = clamp01(hsl.l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((hsl.h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

// Derives the full palette from one or two main colors via HSL: the primary drives the
// darker tones (medium slice, border, rim, hub, title), the secondary the lighter tones
// (light slice, plate, hub center). If no secondary is given, one is derived from the
// primary (a light, less-saturated tint of the same hue).
export function derivePalette(primaryHex: string, secondaryHex?: string): Record<string, string> {
  const p = hexToHsl(primaryHex) ?? { h: 288, s: 0.42, l: 0.51 }; // fallback: grape-ish purple
  const s = (secondaryHex ? hexToHsl(secondaryHex) : undefined) ?? { h: p.h, s: clamp01(p.s * 0.7), l: 0.8 };
  const deepS = Math.min(0.72, p.s + 0.05);
  return {
    "--slice-bg-even": hslToHex({ h: p.h, s: Math.min(0.72, p.s), l: 0.55 }),
    "--slice-bg-odd": hslToHex({ h: s.h, s: s.s, l: 0.8 }),
    "--slice-border": hslToHex({ h: p.h, s: deepS, l: 0.38 }),
    "--centerpiece-bg": hslToHex({ h: p.h, s: deepS, l: 0.34 }),
    "--rim-color": hslToHex({ h: p.h, s: deepS, l: 0.34 }),
    "--hub-inner": hslToHex({ h: s.h, s: Math.min(0.6, s.s), l: 0.92 }),
    "--plate-bg": hslToHex({ h: s.h, s: s.s, l: 0.88 }),
    "--title-color": hslToHex({ h: p.h, s: deepS, l: 0.34 }),
    "--entry-color": "#ffffff",
  };
}

export function resolveScheme(fieldData: FieldData): ColorScheme {
  const raw = typeof fieldData.colorScheme === "string" ? fieldData.colorScheme : DEFAULT_SCHEME;

  // Simple default: derive the whole palette from one or two main colors.
  if (raw === "auto") {
    const primary = typeof fieldData.colorPrimary === "string" && fieldData.colorPrimary.length > 0
      ? fieldData.colorPrimary
      : (FIELD_DEFAULTS.colorPrimary as string);
    const secondaryRaw = typeof fieldData.colorSecondary === "string" ? fieldData.colorSecondary : "";
    const secondary = secondaryRaw.length > 0 ? secondaryRaw : undefined;
    return { kind: "named", name: "auto", vars: derivePalette(primary, secondary) };
  }

  if (raw !== "custom") {
    // Unknown named preset falls back to the default palette so the wheel is never uncolored.
    const vars = SCHEME_VARS[raw] ?? SCHEME_VARS.grape ?? {};
    return { kind: "named", name: raw, vars };
  }

  // Advanced: each color picker maps to a CSS var.
  const vars: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(CUSTOM_VAR_MAP)) {
    const v = fieldData[key];
    if (typeof v === "string" && v.length > 0) vars[cssVar] = v;
  }
  return { kind: "custom", vars };
}
