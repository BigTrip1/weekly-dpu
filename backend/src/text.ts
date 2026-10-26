export function canonText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalize(input: string): string {
  let s = (input || "").toLowerCase().replace(/['’]/g, "");
  s = s.replace(/o\s*[./]\s*o\s*[./]\s*l/g, " out of line ");
  s = s.replace(/(\d)\.(\d)/g, "$1§$2");
  s = s.replace(/[^a-z0-9/+§]+/g, " ");
  s = s.replace(/§/g, ".");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\binop\b/g, "inoperative");
  s = s.replace(/\breqd\b/g, "required");
  s = s.replace(/\breqs\b/g, "required");
  s = s.replace(/\breq\b/g, "required");
  s = s.replace(/\bool\b/g, "out of line");
  return s.replace(/\s+/g, " ").trim();
}

export function readable(normalized: string): string {
  if (!normalized) return "Unspecified fault";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const GENERIC_WORDS = new Set([
  "tight",
  "loose",
  "damaged",
  "missing",
  "inoperative",
  "shortage",
  "leaking",
  "fouling",
  "foul",
  "stiff",
  "high",
  "low",
  "incomplete",
  "poor",
  "dirty",
  "broken",
  "solid",
]);

export function isGenericWord(normalized: string): boolean {
  return GENERIC_WORDS.has(normalized);
}

export function isGenericCheck(check: string): boolean {
  const n = normalize(check);
  if (!n) return true;
  return n.includes("additional findings");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsTerm(haystack: string, term: string): boolean {
  const pattern = normalize(term);
  if (!pattern || !haystack) return false;
  if (!pattern.includes(" ") && pattern.length <= 3) {
    return new RegExp(`(?:^|\\s)${escapeRegExp(pattern)}(?:\\s|$)`).test(haystack);
  }
  return haystack.includes(pattern);
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
