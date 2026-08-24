import type { ChatEventData } from "./types.js";
import type { CommandPermission } from "../config/parse.js";

// The set of Twitch badge names on a chat message, gathered from however SE delivers them:
// an array of { type }, an object map keyed by badge name, and/or the raw IRC "badges" tag
// ("broadcaster/1,subscriber/12,...").
function badgeNames(data: ChatEventData): Set<string> {
  const names = new Set<string>();
  const badges = data.badges;
  if (Array.isArray(badges)) {
    for (const badge of badges) {
      const type = badge && typeof badge === "object" ? (badge as { type?: unknown }).type : badge;
      if (typeof type === "string" && type.length > 0) names.add(type.toLowerCase());
    }
  } else if (badges && typeof badges === "object") {
    for (const key of Object.keys(badges)) {
      if ((badges as Record<string, unknown>)[key]) names.add(key.toLowerCase());
    }
  }
  const rawBadges = data.tags?.badges;
  if (typeof rawBadges === "string") {
    for (const segment of rawBadges.split(",")) {
      const name = segment.split("/")[0];
      if (name) names.add(name.toLowerCase());
    }
  }
  return names;
}

function isBroadcaster(data: ChatEventData, broadcasterUsername: string | undefined): boolean {
  // Definitive on Twitch: the message author is the channel owner (their user id equals the
  // channel's room id).
  const roomId = data.tags?.["room-id"];
  const userId = data.tags?.["user-id"];
  if (roomId && userId && roomId === userId) return true;
  if (badgeNames(data).has("broadcaster")) return true;
  // Fallback for shapes without ids/badges: the sender's name matches the channel name.
  const nick = (data.nick ?? data.displayName ?? "").toLowerCase();
  return nick.length > 0 && nick === (broadcasterUsername ?? "").toLowerCase();
}

function isModerator(data: ChatEventData): boolean {
  // The IRC mod tag is set for every moderator, whatever their badge.
  if (data.tags?.mod === "1") return true;
  // Also accept any moderator-type badge (moderator, and any lead_moderator variant).
  for (const name of badgeNames(data)) {
    if (name.includes("moderator")) return true;
  }
  return false;
}

// A lead moderator carries the lead_moderator badge (in addition to being a moderator).
function isLeadModerator(data: ChatEventData): boolean {
  for (const name of badgeNames(data)) {
    if (name.includes("lead") && name.includes("moderator")) return true;
  }
  return false;
}

export function isBroadcasterOrMod(data: ChatEventData, broadcasterUsername: string | undefined): boolean {
  return isBroadcaster(data, broadcasterUsername) || isModerator(data);
}

export function hasCommandPermission(
  permission: CommandPermission,
  data: ChatEventData,
  broadcasterUsername: string | undefined,
): boolean {
  if (isBroadcaster(data, broadcasterUsername)) return true;
  switch (permission) {
    case "broadcaster":
      return false;
    case "leadmods":
      return isLeadModerator(data);
    case "mods":
      return isModerator(data);
  }
}
