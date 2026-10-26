// Fixed order and colour per executive department, shared by the panels and the charts.
export const DEPARTMENTS = [
  "Shot & Paint",
  "Manufacturing Facilities",
  "Parts / POF",
  "Production",
  "Cab Systems",
  "Supplier Quality",
] as const;

export const OFF_PANEL = "Off panel";

export function departmentColor(name: string): string {
  if (name === OFF_PANEL) {
    // Dimmer than the Supplier Quality grey, so hidden and unmapped faults read as a separate group.
    return "color-mix(in oklab, var(--muted-foreground) 40%, transparent)";
  }
  const index = DEPARTMENTS.indexOf(name as (typeof DEPARTMENTS)[number]);
  return `var(--dept-${index >= 0 ? index + 1 : 6})`;
}

export function departmentKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
