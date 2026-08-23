import { weight, sliceIndex } from "../model/units.js";
import { EPSILON_WEIGHT, type Slice } from "./slices.js";
import type { ConfigError, Parsed } from "./errors.js";

export interface Category {
  id: string;
  name: string;
  weight: number;
  color?: string;
}

export interface Item {
  text: string;
  weight: number;
  categoryId?: string;
}

export interface AdvancedConfig {
  categories: Category[];
  items: Item[];
}

// Sentinel key for the synthetic "Uncategorized" group. A Symbol, not a string, so no
// JSON-supplied category id (always a string) can ever collide with it under ===.
const UNCATEGORIZED_ID = Symbol("uncategorized");
type GroupId = string | typeof UNCATEGORIZED_ID;

function isValidCategory(v: unknown): v is Category {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.weight === "number" &&
    Number.isFinite(o.weight) &&
    (o.color === undefined || typeof o.color === "string")
  );
}

function isValidItem(v: unknown): v is Item {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.text === "string" &&
    typeof o.weight === "number" &&
    Number.isFinite(o.weight) &&
    (o.categoryId === undefined || typeof o.categoryId === "string")
  );
}

// Parses and validates the advancedConfig field's JSON text. Non-empty input that
// fails to parse or fails shape validation is a typed error, never a silent fallback.
export function parseAdvancedConfig(raw: string): Parsed<AdvancedConfig> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { kind: "error", errors: [{ kind: "bad-advanced-json", message: e instanceof Error ? e.message : String(e) }] };
  }

  if (typeof json !== "object" || json === null) {
    return { kind: "error", errors: [{ kind: "bad-advanced-json", message: "root must be an object" }] };
  }
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.categories) || !Array.isArray(obj.items)) {
    return { kind: "error", errors: [{ kind: "bad-advanced-json", message: "categories and items must be arrays" }] };
  }

  const errors: ConfigError[] = [];
  const categories: Category[] = [];
  obj.categories.forEach((c, i) => {
    if (!isValidCategory(c)) {
      errors.push({ kind: "bad-advanced-json", message: `categories[${i}] must have id, name, weight` });
      return;
    }
    categories.push(c.color !== undefined ? { id: c.id, name: c.name, weight: c.weight, color: c.color } : { id: c.id, name: c.name, weight: c.weight });
  });

  const items: Item[] = [];
  obj.items.forEach((it, i) => {
    if (!isValidItem(it)) {
      errors.push({ kind: "bad-advanced-json", message: `items[${i}] must have text, weight` });
      return;
    }
    items.push(it.categoryId !== undefined ? { text: it.text, weight: it.weight, categoryId: it.categoryId } : { text: it.text, weight: it.weight });
  });

  if (errors.length > 0) return { kind: "error", errors };
  if (items.length === 0) return { kind: "error", errors: [{ kind: "empty-advanced" }] };

  return { kind: "ok", value: { categories, items } };
}

// Appends runtime-added entries (chat/reward extras) as Uncategorized items, so the
// controller's extras keep showing up on the wheel when advancedConfig is active --
// same role effectiveSliceEntries plays for the plain sliceEntries path.
export function withExtraItems(cfg: AdvancedConfig, extraTexts: readonly string[]): AdvancedConfig {
  if (extraTexts.length === 0) return cfg;
  const extraItems: Item[] = extraTexts.map((text) => ({ text, weight: 1 }));
  return { categories: cfg.categories, items: [...cfg.items, ...extraItems] };
}

// Two-level weighting: catShare(cat) * itemShare(item within cat), producing final
// arc-weight fractions that geometry.layout() renormalizes, so the products can be
// handed to it directly.
export function resolveAdvancedWeights(cfg: AdvancedConfig): Slice[] {
  const categoriesById = new Map(cfg.categories.map((c) => [c.id, c] as const));

  // Group items by resolved category; an unknown or absent categoryId falls into the
  // synthetic Uncategorized group. A category with no items never appears here, so it
  // contributes nothing (per spec: empty categories contribute nothing).
  const groups = new Map<GroupId, Item[]>();
  for (const item of cfg.items) {
    const id: GroupId = item.categoryId !== undefined && categoriesById.has(item.categoryId) ? item.categoryId : UNCATEGORIZED_ID;
    const list = groups.get(id);
    if (list) list.push(item);
    else groups.set(id, [item]);
  }

  // Uncategorized's weight: the average of the defined categories' weights, so it
  // competes for a "typical" share instead of dominating or vanishing; 1 if no
  // categories are defined. Non-positive category weights count as 0 toward the
  // average, consistent with them contributing 0 to catShare below.
  const avgCatWeight =
    cfg.categories.length > 0 ? cfg.categories.reduce((s, c) => s + Math.max(c.weight, 0), 0) / cfg.categories.length : 1;

  const weightOfGroup = (id: GroupId): number => (id === UNCATEGORIZED_ID ? avgCatWeight : categoriesById.get(id)!.weight);

  const groupIds = [...groups.keys()];
  const catWeightSum = groupIds.reduce((s, id) => s + Math.max(weightOfGroup(id), 0), 0);
  const catShare = (id: GroupId): number => {
    const w = weightOfGroup(id);
    if (w <= 0 || catWeightSum <= 0) return 0; // weight <= 0 contributes 0, per spec
    return w / catWeightSum;
  };

  const slices: Slice[] = [];
  let i = 0;
  for (const id of groupIds) {
    const items = groups.get(id)!;
    const itemWeightSum = items.reduce((s, it) => s + it.weight, 0);
    const color = id === UNCATEGORIZED_ID ? undefined : categoriesById.get(id)!.color;
    const share = catShare(id);
    for (const item of items) {
      const itemShare = itemWeightSum !== 0 ? item.weight / itemWeightSum : NaN;
      const finalShare = share * itemShare;
      // Zero/negative/NaN shares (a zero-weight category, an item with weight <= 0, or
      // an all-zero item-weight group) still render as a thin sliver instead of
      // vanishing -- same convention as slices.ts's EPSILON_WEIGHT.
      const w = Number.isFinite(finalShare) && finalShare > 0 ? finalShare : EPSILON_WEIGHT;
      slices.push({
        index: sliceIndex(i),
        text: item.text,
        weight: weight(w),
        ...(color ? { color } : {}),
      });
      i++;
    }
  }
  return slices;
}
