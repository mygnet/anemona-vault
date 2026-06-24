export function getDueTone(dueAt: string): "late" | "soon" | "future" {
  if (!dueAt) return "future";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return "future";
  if (diff < 0) return "late";
  if (diff <= 1000 * 60 * 60 * 24 * 3) return "soon";
  return "future";
}

export interface RelativeDueResult {
  value: number;
  unit: string;
  overdue: boolean;
}

export function getRelativeDue(dueAt: string): RelativeDueResult | null {
  if (!dueAt) return null;
  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) return null;
  const diff = dueTime - Date.now();
  const overdue = diff < 0;
  const absoluteMinutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
  const units = [
    { label: "month", minutes: 60 * 24 * 30 },
    { label: "week", minutes: 60 * 24 * 7 },
    { label: "day", minutes: 60 * 24 },
    { label: "hour", minutes: 60 },
    { label: "minute", minutes: 1 },
  ];
  const unit = units.find((u) => absoluteMinutes >= u.minutes) || units[units.length - 1];
  const value = Math.max(1, Math.round(absoluteMinutes / unit.minutes));
  return { value, unit: unit.label, overdue };
}
