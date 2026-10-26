import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { TriangleAlertIcon } from "lucide-react";

import { getExplore, type AnalyticsFilters, type ExploreMeasure, type RecordQuery } from "@/api";
import { ChartCard } from "@/components/analytics/ChartCard";
import type { DrillSpec } from "@/components/analytics/types";
import { useAsync } from "@/components/analytics/useAsync";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFpb, formatInt } from "@/format";
import { departmentColor } from "@/lib/departments";

type Props = {
  filters: AnalyticsFilters;
  filterKey: string;
  onDrill: (spec: DrillSpec) => void;
};

const MEASURES: { value: ExploreMeasure; label: string }[] = [
  { value: "faults", label: "Faults" },
  { value: "builds", label: "Distinct builds" },
  { value: "faultsPerBuild", label: "Faults per build" },
];

const BREAKDOWNS: { value: string; label: string; query: (label: string) => RecordQuery }[] = [
  { value: "department", label: "Department", query: (label) => ({ department: label }) },
  { value: "model", label: "Model", query: (label) => ({ model: label }) },
  { value: "machineArea", label: "Machine area", query: (label) => ({ machineArea: label }) },
  { value: "defectType", label: "Defect type", query: (label) => ({ defectType: label }) },
  { value: "workCenter", label: "Work centre", query: (label) => ({ workCenter: label }) },
  { value: "failedTo", label: "Failed To", query: (label) => ({ failedTo: label }) },
  { value: "hour", label: "Hour of day", query: (label) => ({ hour: label }) },
  { value: "weekday", label: "Weekday", query: (label) => ({ weekday: label }) },
  { value: "week", label: "Week commencing", query: (label) => ({ week: label }) },
  { value: "month", label: "Month", query: (label) => ({ month: label }) },
];

const LIMITS = ["10", "15", "25", "40"];
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

function PickerSelect({ label, value, onChange, options, width }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; width: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ExplorerTab({ filters, filterKey, onDrill }: Props) {
  const [measure, setMeasure] = useState<ExploreMeasure>("faults");
  const [by, setBy] = useState("department");
  const [limit, setLimit] = useState("15");
  const [shape, setShape] = useState<"bars" | "line">("bars");

  const { data, loading, error } = useAsync(() => getExplore(filters, measure, by, Number(limit)), `explore|${filterKey}|${measure}|${by}|${limit}`);
  const breakdown = BREAKDOWNS.find((item) => item.value === by) ?? BREAKDOWNS[0];
  const measureLabel = MEASURES.find((item) => item.value === measure)?.label ?? "Faults";
  const rows = data?.rows ?? [];
  const isTime = data?.time ?? false;
  const canLine = isTime && (by === "week" || by === "month");
  const useLine = canLine && shape === "line";
  const config: ChartConfig = { value: { label: measureLabel, color: "var(--primary)" } };
  const format = (value: number | string) => (measure === "faultsPerBuild" ? formatFpb(Number(value)) : formatInt(Number(value)));

  function open(label: string) {
    onDrill({
      eyebrow: breakdown.label,
      color: by === "department" ? departmentColor(label) : undefined,
      title: `${breakdown.label}: ${label}`,
      query: breakdown.query(label),
    });
  }

  const colourOf = (row: { label: string; lowVolume: boolean }) => (by === "department" ? departmentColor(row.label) : "var(--primary)");

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      <section aria-label="Explorer controls" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card p-2.5 shadow-sm">
        <PickerSelect label="Measure" value={measure} onChange={(value) => setMeasure(value as ExploreMeasure)} options={MEASURES} width="w-44" />
        <PickerSelect label="By" value={by} onChange={setBy} options={BREAKDOWNS.map(({ value, label }) => ({ value, label }))} width="w-48" />
        {!(by === "hour" || by === "weekday") && (
          <PickerSelect label={isTime ? "Latest" : "Top"} value={limit} onChange={setLimit} options={LIMITS.map((value) => ({ value, label: value }))} width="w-20" />
        )}
        {canLine && (
          <div className="flex items-center gap-1" role="group" aria-label="Chart shape">
            {(["bars", "line"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={shape === item}
                onClick={() => setShape(item)}
                className={`h-8 cursor-pointer rounded-md px-3 text-xs font-bold tracking-wide capitalize transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                  shape === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </section>

      <ChartCard
        title={`${measureLabel} by ${breakdown.label.toLowerCase()}`}
        description={
          measure === "faultsPerBuild"
            ? "Faults divided by distinct builds in each group. Groups with fewer than 5 builds are dimmed and listed last. Select a mark to open its records."
            : "Select a bar or a point to open the records behind it."
        }
        loading={loading}
        empty={rows.length === 0}
      >
        {isTime ? (
          <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
            {useLine ? (
              <LineChart data={rows} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={52} />
                <RTooltip content={<ChartTooltipContent valueFormatter={format} />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={measureLabel}
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={(dotProps: { cx?: number; cy?: number; index?: number; payload?: { label: string } }) => {
                    const { cx, cy, payload, index } = dotProps;
                    if (cx == null || cy == null || !payload) return <g key={index} />;
                    return (
                      <g key={index} style={{ cursor: "pointer" }} onClick={() => open(payload.label)}>
                        <circle cx={cx} cy={cy} r={10} fill="transparent" />
                        <circle cx={cx} cy={cy} r={3.5} fill="var(--primary)" />
                      </g>
                    );
                  }}
                  activeDot={false}
                />
              </LineChart>
            ) : (
              <BarChart data={rows} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={by === "hour" ? 1 : "preserveStartEnd"} />
                <YAxis tickLine={false} axisLine={false} width={52} />
                <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ChartTooltipContent valueFormatter={format} />} />
                <Bar
                  dataKey="value"
                  name={measureLabel}
                  fill="var(--primary)"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(entry) => {
                    const label = (entry as { label?: string }).label;
                    if (label) open(label);
                  }}
                />
              </BarChart>
            )}
          </ChartContainer>
        ) : (
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rows.length * 28 + 36 }}>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={170} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} tickFormatter={(value: string) => clip(value, 27)} />
              <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ChartTooltipContent valueFormatter={format} />} />
              <Bar
                dataKey="value"
                name={measureLabel}
                radius={[0, 4, 4, 0]}
                barSize={16}
                cursor="pointer"
                isAnimationActive={false}
                onClick={(entry) => {
                  const label = (entry as { label?: string }).label;
                  if (label) open(label);
                }}
              >
                {rows.map((row) => (
                  <Cell key={row.key} fill={colourOf(row)} fillOpacity={row.lowVolume ? 0.35 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      <ChartCard title="The numbers" description="All three measures for the same groups, so the chart can be checked." loading={loading} empty={rows.length === 0}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{breakdown.label}</TableHead>
              <TableHead className="text-right">Faults</TableHead>
              <TableHead className="text-right">Builds</TableHead>
              <TableHead className="text-right">Faults / build</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => open(row.label)}
                    className="cursor-pointer text-left font-semibold underline decoration-border underline-offset-4 transition-colors hover:text-primary-foreground hover:decoration-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:text-primary"
                  >
                    {row.label}
                  </button>
                  {row.lowVolume && (
                    <Badge variant="flat" className="ml-2">
                      Low volume
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatInt(row.faults)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatInt(row.builds)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatFpb(row.faultsPerBuild)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  );
}
