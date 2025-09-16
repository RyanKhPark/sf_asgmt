// Small helpers for text normalization and scoring

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function toWords(s: string): string[] {
  return normalizeText(s).split(" ").filter((w) => w.length >= 3);
}

export function sentenceSplit(s: string): string[] {
  return s
    .replace(/\n+/g, " ")
    .split(/(?<=[\.!?])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function jaccard(aSet: Set<string>, bSet: Set<string>): number {
  const aArray = Array.from(aSet);
  const bArray = Array.from(bSet);
  const inter = new Set(aArray.filter((x) => bSet.has(x))).size;
  const uni = new Set([...aArray, ...bArray]).size || 1;
  return inter / uni;
}

