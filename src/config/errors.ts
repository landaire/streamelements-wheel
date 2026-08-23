export type ConfigError =
  | { kind: "empty-slice-list" }
  | { kind: "bad-weight"; entry: string; raw: string }
  | { kind: "missing-field"; key: string }
  | { kind: "bad-field-type"; key: string }
  | { kind: "bad-advanced-json"; message: string }
  | { kind: "empty-advanced" };

export type Parsed<T> =
  | { kind: "ok"; value: T }
  | { kind: "error"; errors: ConfigError[] };
