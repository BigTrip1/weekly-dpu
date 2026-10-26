export function formatInt(value: number): string {
  return value.toLocaleString("en-GB");
}

export function formatFpb(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatShare(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTrend(value: number | null): string {
  if (value == null) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

export function formatShareChange(value: number | null): string {
  if (value == null) return "—";
  const text = `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return text;
}

export function tone(value: number | null): "up" | "down" | "flat" | "na" {
  if (value == null) return "na";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
