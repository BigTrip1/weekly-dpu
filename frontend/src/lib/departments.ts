// Fixed order and colour per executive department, shared by the panels and the charts.
export const DEPARTMENTS = [
  "Shot & Paint",
  "Manufacturing Facilities",
  "Parts / POF",
  "Production",
  "Cab Systems",
  "Supplier Quality",
] as const;

export function departmentColor(name: string): string {
  const index = DEPARTMENTS.indexOf(name as (typeof DEPARTMENTS)[number]);
  return `var(--dept-${index >= 0 ? index + 1 : 6})`;
}

export function departmentKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
