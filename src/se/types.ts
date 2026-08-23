export type FieldValue = string | number | boolean | undefined;
export type FieldData = Record<string, FieldValue>;

export interface WidgetLoadDetail {
  fieldData: FieldData;
  channel?: { id: string; username: string };
}

// SE event shapes vary across event types and SE versions; keep this loose.
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
    };
  };
}
