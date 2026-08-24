import type { FieldData, FieldValue } from "../se/types.js";
import { FIELD_DEFAULTS } from "./fields.js";
import { inflateRaw } from "./inflate.js";

// Versioned config-code format. A code beginning with this prefix is raw-DEFLATE compressed;
// a code with no prefix is a legacy (uncompressed) base64url JSON, kept working forever.
const CONFIG_PREFIX = "LW1";

// base64url -> string. Mirrors the legacy encoder (btoa(unescape(encodeURIComponent)))
// so an old code copied from a playground URL decodes byte-for-byte here.
function fromBase64Url(code: string): string {
  let b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

function base64UrlToBytes(code: string): Uint8Array {
  let b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000; // chunk the fromCharCode calls so a large data URL never overflows the arg list
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function legacyEncode(json: string): string {
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Compresses a config object to a versioned code. Uses the browser-native CompressionStream
// (deflate-raw) when available; otherwise falls back to a legacy uncompressed code that any
// decoder still reads. Async only because CompressionStream is stream-based.
export async function encodeSharedConfig(obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  const CS = (globalThis as { CompressionStream?: unknown }).CompressionStream as
    | (new (format: string) => ReadableWritablePair<Uint8Array, Uint8Array>)
    | undefined;
  if (typeof CS !== "function") return legacyEncode(json);
  const stream = new Blob([new TextEncoder().encode(json)]).stream().pipeThrough(new CS("deflate-raw"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return CONFIG_PREFIX + bytesToBase64Url(compressed);
}

// Accepts a raw config code or a full playground URL (anything after the last '#'). Returns
// the decoded field-data object, or undefined when empty/invalid. Synchronous for both the
// compressed and legacy forms, so the mount path never has to become async.
export function decodeSharedConfig(input: string): Record<string, FieldValue> | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  const hashAt = trimmed.lastIndexOf("#");
  const code = hashAt >= 0 ? trimmed.slice(hashAt + 1) : trimmed;
  if (code.length === 0) return undefined;
  try {
    const json = code.startsWith(CONFIG_PREFIX)
      ? new TextDecoder().decode(inflateRaw(base64UrlToBytes(code.slice(CONFIG_PREFIX.length))))
      : fromBase64Url(code);
    const data: unknown = JSON.parse(json);
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
