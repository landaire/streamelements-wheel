export type ConfigError =
  | { kind: "empty-slice-list" }
  | { kind: "bad-weight"; entry: string; raw: string }
  | { kind: "missing-field"; key: string };

export type Parsed<T> =
  | { kind: "ok"; value: T }
  | { kind: "error"; errors: ConfigError[] };
