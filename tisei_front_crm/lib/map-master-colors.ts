/** Стабильные цвета меток / легенды «по мастеру» на карте. */
export const MASTER_MAP_COLORS = [
  "#00626a",
  "#c62828",
  "#1565c0",
  "#6a1b9a",
  "#ef6c00",
  "#2e7d32",
  "#ad1457",
  "#4527a0",
  "#00838f",
  "#5d4037",
] as const;

export const UNASSIGNED_MAP_COLOR = "#ba1a1a";

export function masterMapColor(
  executorId: string | undefined,
  executorIndex: Map<string, number>,
): string {
  if (!executorId) return UNASSIGNED_MAP_COLOR;
  const idx = executorIndex.get(executorId) ?? 0;
  return MASTER_MAP_COLORS[idx % MASTER_MAP_COLORS.length]!;
}
