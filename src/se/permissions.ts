import type { ChatEventData } from "./types.js";
import type { CommandPermission } from "../config/parse.js";

// Broadcaster identity is inferred by nick match (SE does not send a broadcaster flag
// directly); mod status comes from tags.mod or a broadcaster/moderator badge, checked
// across the couple of shapes SE has used for badges.
export function isBroadcasterOrMod(data: ChatEventData, broadcasterUsername: string | undefined): boolean {
  const nick = (data.nick ?? data.displayName ?? "").toLowerCase();
  const isBroadcaster = nick.length > 0 && nick === (broadcasterUsername ?? "").toLowerCase();
  const isMod =
    data.tags?.mod === "1" ||
    /broadcaster|moderator/.test(String(data.tags?.badges ?? "")) ||
    Boolean(data.badges && (data.badges.broadcaster || data.badges.moderator));
  return isBroadcaster || isMod;
}

function isBroadcaster(data: ChatEventData, broadcasterUsername: string | undefined): boolean {
  const nick = (data.nick ?? data.displayName ?? "").toLowerCase();
  if (nick.length > 0 && nick === (broadcasterUsername ?? "").toLowerCase()) return true;
  // Fallback: a broadcaster badge/flag, so the broadcaster is recognized even when the
  // channel username is unknown (e.g. a mount that missed onWidgetLoad) or the nick differs.
  return /broadcaster/.test(String(data.tags?.badges ?? "")) || Boolean(data.badges && data.badges.broadcaster);
}

export function hasCommandPermission(
  permission: CommandPermission,
  data: ChatEventData,
  broadcasterUsername: string | undefined,
): boolean {
  return permission === "broadcaster" ? isBroadcaster(data, broadcasterUsername) : isBroadcasterOrMod(data, broadcasterUsername);
}
