import { Bar, BarChart, CartesianGrid, Cell, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { TriangleAlertIcon } from "lucide-react";

import { getPatterns, type AnalyticsFilters } from "@/api";
import { ChartCard } from "@/components/analytics/ChartCard";
import { Heatmap } from "@/components/analytics/Heatmap";
import { StackedBars } from "@/components/analytics/StackedBars";
import type { DrillSpec } from "@/components/analytics/types";
import { useAsync } from "@/components/analytics/useAsync";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFpb, formatInt } from "@/format";
import { departmentColor } from "@/lib/departments";

type Props = {
  filters: AnalyticsFilters;
  filterKey: string;
  onDrill: (spec: DrillSpec) => void;
};

const countConfig: ChartConfig = { count: { label: "Faults", color: "var(--primary)" } };

export function PatternsTab({ filters, filterKey, onDrill }: Props) {
  const { data, loading, error } = useAsync(() => getPatterns(filters), `patterns|${filterKey}`);
  const empty = !data || data.totals.faults === 0;
  const maxFpb = Math.max(1, ...(data?.models ?? []).filter((row) => !row.lowVolume).map((row) => row.faultsPerBuild ?? 0));

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      <ChartCard
        title="Machine area against defect type"
        description={
          data ? (
            <>
              {formatInt(data.totals.faults)} faults across {formatInt(data.totals.uniqueBuilds)} builds. The twelve busiest machine areas against the ten most common defect types. Select a cell, a row name or a column name.
            </>
          ) : (
            "Where problems cluster"
          )
        }
        loading={loading}
        empty={empty}
      >
        {data && (
          <Heatmap
            areas={data.heatmap.areas}
            defects={data.heatmap.defects}
            cells={data.heatmap.cells}
            onCell={(area, defect) => onDrill({ eyebrow: "Machine area and defect type", title: `${area}, ${defect}`, query: { machineArea: area, defectType: defect } })}
            onArea={(area) => onDrill({ eyebrow: "Machine area", title: `All ${area} faults`, query: { machineArea: area } })}
            onDefect={(defect) => onDrill({ eyebrow: "Defect type", title: `All ${defect} faults`, query: { defectType: defect } })}
          />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Faults by hour of day"
          description="From Failed Time. Select a bar to open that hour."
          loading={loading}
          empty={empty}
        >
          {data && (
            <ChartContainer config={countConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={data.hours} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={1} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  name="Faults"
                  fill="var(--primary)"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(entry) => {
                    const hour = (entry as { hour?: string }).hour;
                    if (hour) onDrill({ eyebrow: "Hour of day", title: `Faults failed between ${hour}:00 and ${hour}:59`, query: { hour } });
                  }}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Faults by weekday"
          description="From Failed Date. Select a bar to open that weekday."
          loading={loading}
          empty={empty}
        >
          {data && (
            <ChartContainer config={countConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={data.weekdays} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="weekday" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  name="Faults"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(entry) => {
                    const weekday = (entry as { weekday?: string }).weekday;
                    if (weekday) onDrill({ eyebrow: "Weekday", title: `Faults failed on ${weekday}`, query: { weekday } });
                  }}
                >
                  {data.weekdays.map((item) => (
                    <Cell key={item.weekday} fill={item.index >= 5 ? "var(--dept-3)" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Model league"
        description="Faults per build is faults divided by distinct builds of that model in the range. Models with fewer than 5 builds are marked low volume."
        loading={loading}
        empty={empty || (data?.models.length ?? 0) === 0}
      >
        {data && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Faults</TableHead>
                <TableHead className="text-right">Builds</TableHead>
                <TableHead className="min-w-[12rem]">Faults / build</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.models.map((row) => (
                <TableRow key={row.model}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onDrill({ eyebrow: "Model", title: `All ${row.model} faults`, query: { model: row.model } })}
                      className="cursor-pointer text-left font-semibold underline decoration-border underline-offset-4 transition-colors hover:text-primary-foreground hover:decoration-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:text-primary"
                    >
                      {row.model}
                    </button>
                    {row.lowVolume && (
                      <Badge variant="flat" className="ml-2">
                        Low volume
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.faults)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.builds)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${row.lowVolume ? 0 : Math.max(((row.faultsPerBuild ?? 0) / maxFpb) * 100, 3)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-xs tabular-nums">{formatFpb(row.faultsPerBuild)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Defect-type mix by department"
          description="The twelve most common defect types, split by the department the fault landed on. Off panel is hidden or unmapped."
          loading={loading}
          empty={empty}
        >
          {data && (
            <StackedBars
              rows={data.defectMix}
              departments={data.departments}
              onSelect={(label, department) =>
                onDrill({
                  eyebrow: department,
                  color: departmentColor(department),
                  title: `${label} faults`,
                  query: { defectType: label, department },
                })
              }
            />
          )}
        </ChartCard>

        <ChartCard
          title="Work-centre load"
          description="Where faults were raised on the line, split by the department responsible. A work centre is a place, not a team."
          loading={loading}
          empty={empty}
        >
          {data && (
            <StackedBars
              rows={data.workCentres}
              departments={data.departments}
              labelWidth={96}
              onSelect={(label, department) =>
                onDrill({
                  eyebrow: department,
                  color: departmentColor(department),
                  title: `${label} faults`,
                  query: { workCenter: label, department },
                })
              }
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
