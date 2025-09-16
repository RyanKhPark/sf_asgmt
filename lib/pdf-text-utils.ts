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
  const inter = new Set([...aSet].filter((x) => bSet.has(x))).size;
  const uni = new Set([...aSet, ...bSet]).size || 1;
  return inter / uni;
}

