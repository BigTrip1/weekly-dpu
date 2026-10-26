import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterXIcon, TriangleAlertIcon } from "lucide-react";

import { getAnalyticsMeta, getAnalyticsRecords, type AnalyticsFilters } from "@/api";
import { ExplorerTab } from "@/components/analytics/ExplorerTab";
import { FaultsTab } from "@/components/analytics/FaultsTab";
import { PatternsTab } from "@/components/analytics/PatternsTab";
import type { DrillSpec } from "@/components/analytics/types";
import { useAsync } from "@/components/analytics/useAsync";
import { DrillSheet } from "@/components/dashboard/DrillSheet";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "4w", label: "Last 4 weeks" },
  { value: "8w", label: "Last 8 weeks" },
  { value: "month", label: "This month" },
  { value: "all", label: "All data" },
  { value: "custom", label: "Custom" },
] as const;

type RangeKey = (typeof RANGES)[number]["value"];

const ANY = "any";

function resolveRange(range: RangeKey, min: string, max: string, from: string, to: string) {
  switch (range) {
    case "4w":
      return { from: addDays(max, -27), to: max };
    case "month":
      return { from: `${max.slice(0, 8)}01`, to: max };
    case "all":
      return { from: min, to: max };
    case "custom":
      return { from: from || min, to: to || max };
    default:
      return { from: addDays(max, -55), to: max };
  }
}

function FilterSelect({
  label,
  value,
  options,
  anyLabel,
  onChange,
  width,
}: {
  label: string;
  value: string;
  options: string[];
  anyLabel: string;
  onChange: (value: string) => void;
  width: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{label}</label>
      <Select value={value || ANY} onValueChange={(next) => onChange(next === ANY ? "" : next)}>
        <SelectTrigger aria-label={label} className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Analytics() {
  const [params, setParams] = useSearchParams();
  const [drill, setDrill] = useState<DrillSpec | null>(null);
  const meta = useAsync(getAnalyticsMeta, "meta");

  const tab = params.get("tab") ?? "patterns";
  const rangeParam = params.get("range") as RangeKey | null;
  const range: RangeKey = RANGES.some((item) => item.value === rangeParam) ? (rangeParam as RangeKey) : "8w";
  const department = params.get("department") ?? "";
  const model = params.get("model") ?? "";
  const workCenter = params.get("workCenter") ?? "";

  const min = meta.data?.min ?? "";
  const max = meta.data?.max ?? "";
  const window = useMemo(
    () => (min && max ? resolveRange(range, min, max, params.get("from") ?? "", params.get("to") ?? "") : null),
    [range, min, max, params],
  );

  const filters: AnalyticsFilters | null = window
    ? { from: window.from, to: window.to, department: department || undefined, model: model || undefined, workCenter: workCenter || undefined }
    : null;
  const filterKey = JSON.stringify(filters);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  function pickRange(value: RangeKey) {
    if (value === "custom" && window) update({ range: value, from: window.from, to: window.to });
    else update({ range: value === "8w" ? "" : value, from: "", to: "" });
  }

  const hasFilters = Boolean(department || model || workCenter);

  // Records behind the chart mark that is open. The mark's own field replaces the matching shared filter.
  const records = useAsync(
    () => getAnalyticsRecords(filters ?? {}, drill?.query ?? {}),
    `${filterKey}|${JSON.stringify(drill)}`,
    Boolean(drill && filters),
  );

  const periodLabel = window ? `${formatDay(window.from)} to ${formatDay(window.to)}` : "";

  if (meta.error) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" /> {meta.error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6">
      <PageHeader
        title="Analytics"
        description="Look at the same faults from different angles. Patterns uses the recorded fields as they came in. Faults uses the cleansed names and mapped departments. Select any chart mark to open the records behind it."
      />

      <section
        aria-label="Analytics filters"
        className="z-30 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card p-2.5 shadow-sm md:sticky md:top-[77px]"
      >
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Date range">
          {RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => pickRange(item.value)}
              aria-pressed={range === item.value}
              className={cn(
                "h-8 cursor-pointer rounded-md px-3 text-xs font-bold tracking-wide whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                range === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {range === "custom" && window && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="From" className="h-8 w-36" min={min} max={max} value={window.from} onChange={(event) => update({ from: event.target.value })} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" aria-label="To" className="h-8 w-36" min={min} max={max} value={window.to} onChange={(event) => update({ to: event.target.value })} />
          </div>
        )}
        <FilterSelect
          label="Department"
          value={department}
          options={meta.data?.departments ?? []}
          anyLabel="All departments"
          onChange={(value) => update({ department: value })}
          width="w-52"
        />
        <FilterSelect label="Model" value={model} options={meta.data?.models ?? []} anyLabel="All models" onChange={(value) => update({ model: value })} width="w-40" />
        <FilterSelect
          label="Work centre"
          value={workCenter}
          options={meta.data?.workCenters ?? []}
          anyLabel="All work centres"
          onChange={(value) => update({ workCenter: value })}
          width="w-44"
        />
        <div className="ml-auto flex items-center gap-3">
          {periodLabel && <span className="text-xs text-muted-foreground">{periodLabel}</span>}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => update({ department: "", model: "", workCenter: "" })}>
              <FilterXIcon /> Clear filters
            </Button>
          )}
        </div>
      </section>

      {!filters ? (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : meta.data && meta.data.total === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No faults are loaded yet. Upload a workbook first.</p>
      ) : (
        <Tabs value={tab} onValueChange={(value) => update({ tab: value === "patterns" ? "" : value })}>
          <TabsList>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="faults">Faults</TabsTrigger>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
          </TabsList>
          <TabsContent value="patterns">
            <PatternsTab filters={filters} filterKey={filterKey} onDrill={setDrill} />
          </TabsContent>
          <TabsContent value="faults">
            <FaultsTab filters={filters} filterKey={filterKey} onDrill={setDrill} />
          </TabsContent>
          <TabsContent value="explorer">
            <ExplorerTab filters={filters} filterKey={filterKey} onDrill={setDrill} />
          </TabsContent>
        </Tabs>
      )}

      <DrillSheet
        open={Boolean(drill)}
        eyebrow={drill?.eyebrow ?? ""}
        color={drill?.color}
        title={drill?.title ?? ""}
        periodLabel={periodLabel}
        rows={records.data?.rows ?? null}
        total={records.data?.total ?? 0}
        loading={records.loading}
        onClose={() => setDrill(null)}
      />
    </main>
  );
}
