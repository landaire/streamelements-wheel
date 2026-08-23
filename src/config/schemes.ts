import type { FieldData } from "../se/types.js";
import { FIELD_DEFAULTS } from "./fields.js";

export type ColorScheme =
  | { kind: "named"; name: string }
  | { kind: "custom"; vars: Record<string, string> };

const DEFAULT_SCHEME = FIELD_DEFAULTS.colorScheme as string;

export function resolveScheme(fieldData: FieldData): ColorScheme {
  const raw = typeof fieldData.colorScheme === "string" ? fieldData.colorScheme : DEFAULT_SCHEME;
  if (raw !== "custom") return { kind: "named", name: raw };
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldData)) {
    if (k.startsWith("color") && k !== "colorScheme" && typeof v === "string" && v.length > 0) {
      vars["--" + k] = v;
    }
  }
  return { kind: "custom", vars };
}
