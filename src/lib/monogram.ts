export function normalizeMonogram(symbol: string): string {
  const cleaned = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return cleaned || symbol.slice(0, 2).toUpperCase() || "??";
}
