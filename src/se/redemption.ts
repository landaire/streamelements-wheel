import type { EventReceivedDetail } from "./types.js";

export interface ParsedRedemption {
  rewardTitle: string;
  userInput: string | undefined;
  username: string | undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// SE channel-point redemption event shapes are unverified against a live SE session (no
// access to a real redemption payload while building this). Matches any event whose
// listener mentions "redemption" or "reward", then reads the reward title, the
// redeemer's free-text input, and the redeemer's username from the plausible field
// locations documented in the phase 2 spec. Returns undefined if no reward title is
// found anywhere, since a redemption without a reward title cannot be matched by name.
export function parseRedemption(detail: EventReceivedDetail): ParsedRedemption | undefined {
  const listener = detail.listener ?? detail.event?.listener ?? "";
  if (!/redemption|reward/i.test(listener)) return undefined;

  const data = detail.event?.data;
  if (!data) return undefined;

  const rewardTitle = str(data.redemption?.reward?.title) ?? str(data.reward?.title) ?? str(data.title);
  if (!rewardTitle) return undefined;

  const userInput = str(data.redemption?.userInput) ?? str(data.message) ?? str(data.input);
  const username = str(data.nick) ?? str(data.displayName) ?? str(data.username);

  return { rewardTitle, userInput, username };
}
