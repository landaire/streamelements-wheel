import type { FieldData, FieldValue } from "../se/types.js";
import { FIELD_DEFAULTS } from "./fields.js";

// base64url -> string. Mirrors the playground's encoder (btoa(unescape(encodeURIComponent)))
// so a code copied from the playground URL decodes byte-for-byte here.
function fromBase64Url(code: string): string {
  let b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

// Accepts a raw base64url config code or a full playground URL (anything after the last
// '#'). Returns the decoded field-data object, or undefined when the input is empty or not
// a valid encoded object.
export function decodeSharedConfig(input: string): Record<string, FieldValue> | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  const hashAt = trimmed.lastIndexOf("#");
  const code = hashAt >= 0 ? trimmed.slice(hashAt + 1) : trimmed;
  if (code.length === 0) return undefined;
  try {
    const data: unknown = JSON.parse(fromBase64Url(code));
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, FieldValue>;
  } catch {
    // malformed code: treated as no import
  }
  return undefined;
}

// When importConfig holds a shared config code it is authoritative: the effective field
// data is the defaults overlaid with the decoded diff -- exactly how the playground
// reconstructs a shared link -- so a pasted code reproduces that look regardless of the
// individual fields. The default-valued importConfig ("") clears itself in the result, so
// this is idempotent. An absent or malformed code leaves the field data untouched.
export function applyImportedConfig(fieldData: FieldData): FieldData {
  const raw = fieldData.importConfig;
  if (typeof raw !== "string") return fieldData;
  const decoded = decodeSharedConfig(raw);
  if (!decoded) return fieldData;
  return { ...FIELD_DEFAULTS, ...decoded };
}
