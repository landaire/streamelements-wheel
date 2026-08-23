export type WheelCommand =
  | { cmd: "spin" }
  | { cmd: "add"; arg: string }
  | { cmd: "remove"; arg: string }
  | { cmd: "reset" }
  | { cmd: "pause" }
  | { cmd: "resume" }
  | { cmd: "list" };

// Parses "<baseCommand> <subcommand> [arg]" out of a raw chat message. Matching is
// case-insensitive and tolerant of repeated whitespace. An unrecognized subcommand, or
// add/remove with no argument text, is not a command at all (caller ignores it).
export function parseWheelCommand(text: string, baseCommand: string): WheelCommand | undefined {
  const normalized = text.trim().replace(/\s+/g, " ");
  const base = baseCommand.trim();
  if (base.length === 0) return undefined;

  const lowerNorm = normalized.toLowerCase();
  const lowerBase = base.toLowerCase();
  if (lowerNorm !== lowerBase && !lowerNorm.startsWith(lowerBase + " ")) return undefined;

  // Same length as base regardless of case, so slicing by base.length isolates the rest.
  const rest = normalized.slice(base.length).trim();
  if (rest.length === 0) return undefined;

  const spaceIdx = rest.indexOf(" ");
  const sub = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
  const arg = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1).trim();

  switch (sub) {
    case "spin":
      return { cmd: "spin" };
    case "add":
      return arg.length > 0 ? { cmd: "add", arg } : undefined;
    case "remove":
      return arg.length > 0 ? { cmd: "remove", arg } : undefined;
    case "reset":
      return { cmd: "reset" };
    case "pause":
      return { cmd: "pause" };
    case "resume":
      return { cmd: "resume" };
    case "list":
      return { cmd: "list" };
    default:
      return undefined;
  }
}
