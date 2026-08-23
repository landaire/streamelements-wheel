import type { FieldData } from "../se/types.js";
import { FIELD_DEFAULTS } from "./fields.js";

export type ColorScheme =
  | { kind: "named"; name: string; vars: Record<string, string> }
  | { kind: "custom"; vars: Record<string, string> };

// Each named scheme is a set of the CSS custom properties the render reads. app.ts
// applies scheme.vars onto the widget container, so a named scheme actually recolors.
const SCHEME_VARS: Readonly<Record<string, Record<string, string>>> = {
  fuchsia: {
    "--slice-bg-even": "#c42d9a",
    "--slice-bg-odd": "#f4a6ea",
    "--slice-border": "#8e1e70",
    "--centerpiece-bg": "#8a1a6d",
    "--plate-bg": "#ffdaf6",
    "--title-color": "#8a1a6d",
    "--entry-color": "#ffffff",
  },
  "sweetheart-original": {
    "--slice-bg-even": "#f8acba",
    "--slice-bg-odd": "#ffc2ce",
    "--slice-border": "#c76b7d",
    "--centerpiece-bg": "#b64e5f",
    "--plate-bg": "#ffe1e7",
    "--title-color": "#b64e5f",
    "--entry-color": "#ffffff",
  },
};

const DEFAULT_SCHEME = FIELD_DEFAULTS.colorScheme as string;

export function resolveScheme(fieldData: FieldData): ColorScheme {
  const raw = typeof fieldData.colorScheme === "string" ? fieldData.colorScheme : DEFAULT_SCHEME;
  if (raw !== "custom") {
    // Unknown named scheme falls back to the default palette so the wheel is never uncolored.
    const vars = SCHEME_VARS[raw] ?? SCHEME_VARS[DEFAULT_SCHEME] ?? {};
    return { kind: "named", name: raw, vars };
  }
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldData)) {
    if (k.startsWith("color") && k !== "colorScheme" && typeof v === "string" && v.length > 0) {
      vars["--" + k] = v;
    }
  }
  return { kind: "custom", vars };
}
