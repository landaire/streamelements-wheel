export type FieldValue = string | number | boolean | undefined;
export type FieldData = Record<string, FieldValue>;

export interface WidgetLoadDetail {
  fieldData: FieldData;
  channel?: { id: string; username: string };
}
