/** Stabile merke-farger for presentasjonsgrafer (uavhengig av rangering). */

const MAKE_COLORS: Record<string, string> = {
  volvo: "#003087",
  scania: "#C8102E",
  "mercedes-benz": "#64748B",
  mercedes: "#64748B",
  man: "#CA8A04",
  renault: "#15803D",
  daf: "#0284C7",
  iveco: "#7C3AED",
  ford: "#1E40AF",
  isuzu: "#B45309",
  "john deere": "#367C2B",
  fuso: "#0F766E",
  byd: "#EF4444",
  tesla: "#DC2626",
};

const FALLBACK_COLORS = [
  "#9F1239",
  "#4338CA",
  "#0F766E",
  "#A16207",
  "#BE185D",
  "#334155",
];

function normalizeMake(name: string): string {
  return name.trim().toLowerCase();
}

/** Hash for stabile fallback-farger når merket ikke er i kartet. */
function fallbackIndex(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % FALLBACK_COLORS.length;
}

export function getMakeColor(name: string): string {
  const key = normalizeMake(name);
  return MAKE_COLORS[key] ?? FALLBACK_COLORS[fallbackIndex(key)]!;
}
