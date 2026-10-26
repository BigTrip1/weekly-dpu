export function weekCommencing(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `W/C ${label}`;
}

export function closureStatus(fixedDate: string): "Open" | "Fixed" {
  if (!fixedDate || fixedDate === "2020-01-01") return "Open";
  return "Fixed";
}

export function excelSerialToISO(serial: number): string {
  const days = Math.floor(serial);
  const dt = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
  return dt.toISOString().slice(0, 10);
}

export function localDateISO(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatHMS(value: Date): string {
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  const ss = String(value.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function fractionToTime(fraction: number): string {
  const total = Math.round((fraction % 1) * 86400);
  const normalized = ((total % 86400) + 86400) % 86400;
  const hh = Math.floor(normalized / 3600);
  const mm = Math.floor((normalized % 3600) / 60);
  const ss = normalized % 60;
  return [hh, mm, ss].map((part) => String(part).padStart(2, "0")).join(":");
}

export function weekEnd(isoDate: string): string {
  return addDays(isoDate, 6);
}
