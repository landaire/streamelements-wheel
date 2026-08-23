export type Degrees = number & { readonly __brand: "Degrees" };
export type Turns = number & { readonly __brand: "Turns" };
export type Weight = number & { readonly __brand: "Weight" };
export type SliceIndex = number & { readonly __brand: "SliceIndex" };

export const deg = (n: number): Degrees => n as Degrees;
export const turns = (n: number): Turns => n as Turns;

// Smart-constructors assert invariants; a violation is a programmer error, not data.
export const weight = (n: number): Weight => {
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`weight must be finite and > 0, got ${n}`);
  return n as Weight;
};
export const sliceIndex = (n: number): SliceIndex => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`sliceIndex must be a non-negative integer, got ${n}`);
  return n as SliceIndex;
};

export const normalizeDeg = (d: Degrees): Degrees => ((((d as number) % 360) + 360) % 360) as Degrees;
export const turnsToDeg = (t: Turns): Degrees => ((t as number) * 360) as Degrees;
