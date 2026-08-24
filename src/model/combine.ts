// Combines two slice labels by summing matching terms, for the on-the-line result. Labels
// are split on "+" into terms; a term is either a currency amount (a non-digit prefix then a
// number, e.g. "$10") or a count-and-name (an optional leading number then a name, e.g.
// "Spin" = 1 Spin, "2 Spin" = 2 Spin). Terms with the same key sum; order follows first
// appearance. Non-numeric terms just carry through.
//
// "$10 + Spin" combined with "$20 + Spin" -> "$30 + 2 Spin".

interface CurrencyTerm {
  kind: "currency";
  key: string;
  prefix: string;
  value: number;
}
interface CountTerm {
  kind: "count";
  key: string;
  name: string;
  value: number;
}
type Term = CurrencyTerm | CountTerm;

const CURRENCY_RE = /^(\D+?)\s*(\d+(?:\.\d+)?)$/; // prefix then a trailing number, e.g. "$10"
const COUNT_RE = /^(\d+(?:\.\d+)?)\s+(.+)$/; // leading number then a name, e.g. "2 Spin"

function parseTerm(raw: string): Term {
  const s = raw.trim();
  const cur = CURRENCY_RE.exec(s);
  if (cur) {
    const prefix = cur[1]!.trim();
    return { kind: "currency", key: "cur:" + prefix.toLowerCase(), prefix, value: Number(cur[2]) };
  }
  const cnt = COUNT_RE.exec(s);
  if (cnt) {
    const name = cnt[2]!.trim();
    return { kind: "count", key: "cnt:" + name.toLowerCase(), name, value: Number(cnt[1]) };
  }
  return { kind: "count", key: "cnt:" + s.toLowerCase(), name: s, value: 1 };
}

function parseTerms(label: string): Term[] {
  return label
    .split("+")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(parseTerm);
}

// Trims float noise and drops a trailing ".0" so summed amounts read cleanly.
function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

// Regular English pluralization of the last word, covering the common cases. Leaves the rest
// of the name untouched (e.g. "Free spin" -> "Free spins").
function pluralizeWord(word: string): string {
  const lower = word.toLowerCase();
  if (/s$/.test(lower)) return word; // already ends in s (plural or abbrev like "pts"): leave it
  if (/(?:x|z|ch|sh)$/.test(lower)) return word + "es";
  if (/[^aeiou]y$/.test(lower)) return word.slice(0, -1) + "ies";
  return word + "s";
}
function pluralize(name: string): string {
  const parts = name.split(" ");
  parts[parts.length - 1] = pluralizeWord(parts[parts.length - 1]!);
  return parts.join(" ");
}

function formatTerm(t: Term): string {
  if (t.kind === "currency") return t.prefix + formatNumber(t.value);
  return t.value === 1 ? t.name : formatNumber(t.value) + " " + pluralize(t.name);
}

export function combineLabels(a: string, b: string): string {
  const order: string[] = [];
  const byKey = new Map<string, Term>();
  const add = (label: string): void => {
    for (const t of parseTerms(label)) {
      const existing = byKey.get(t.key);
      if (existing) existing.value += t.value;
      else {
        byKey.set(t.key, { ...t });
        order.push(t.key);
      }
    }
  };
  add(a);
  add(b);
  return order.map((k) => formatTerm(byKey.get(k)!)).join(" + ");
}
