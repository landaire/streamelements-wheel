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
  return nick.length > 0 && nick === (broadcasterUsername ?? "").toLowerCase();
}

export function hasCommandPermission(
  permission: CommandPermission,
  data: ChatEventData,
  broadcasterUsername: string | undefined,
): boolean {
  return permission === "broadcaster" ? isBroadcaster(data, broadcasterUsername) : isBroadcasterOrMod(data, broadcasterUsername);
}
