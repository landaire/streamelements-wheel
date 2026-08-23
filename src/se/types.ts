export type FieldValue = string | number | boolean | undefined;
export type FieldData = Record<string, FieldValue>;

export interface WidgetLoadDetail {
  fieldData: FieldData;
  channel?: { id: string; username: string };
}

// SE event shapes vary across event types and SE versions; keep this loose. The
// redemption-related fields (redemption/reward/title/message/input/username) are
// unverified against a live StreamElements session -- see src/se/redemption.ts.
export interface EventReceivedDetail {
  listener?: string;
  event?: {
    listener?: string;
    data?: {
      text?: string;
      nick?: string;
      displayName?: string;
      tags?: Record<string, string>;
      badges?: Record<string, unknown>;
      redemption?: { reward?: { title?: string }; userInput?: string };
      reward?: { title?: string };
      title?: string;
      message?: string;
      input?: string;
      username?: string;
    };
  };
}

// The shape of a chat message's data payload once listener === "message" is confirmed.
export type ChatEventData = NonNullable<NonNullable<EventReceivedDetail["event"]>["data"]>;
