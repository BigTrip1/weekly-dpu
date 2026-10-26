import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis, Tooltip as RTooltip } from "recharts";

import type { DashboardResponse, TrendResponse } from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInt, formatShare } from "@/format";
import { DEPARTMENTS, departmentColor, departmentKey } from "@/lib/departments";

type Props = {
  dashboard: DashboardResponse;
  trend: TrendResponse | null;
  trendLoading: boolean;
  /** Open the source records behind a chart mark. A week is a Monday date from the weekly trend. */
  onDrill: (department: string, week?: { week: string; label: string }) => void;
};

type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { week?: string; fullLabel?: string };
};

// A small visible dot inside a larger invisible circle, so a point is easy to click.
function TrendDot({ cx, cy, payload, color, department, onDrill }: DotProps & { color: string; department: string; onDrill: Props["onDrill"] }) {
  if (cx == null || cy == null) return null;
  const week = payload?.week;
  return (
    <g
      style={{ cursor: week ? "pointer" : "default" }}
      onClick={() => week && onDrill(department, { week, label: payload?.fullLabel ?? week })}
    >
      <circle cx={cx} cy={cy} r={9} fill="transparent" />
      <circle cx={cx} cy={cy} r={3} fill={color} />
    </g>
  );
}

const shortWeek = (label: string) => label.replace(/^W\/C /, "").replace(/ \d{4}$/, "");

export function DashboardCharts({ dashboard, trend, trendLoading, onDrill }: Props) {
  const deptData = useMemo(
    () =>
      DEPARTMENTS.map((name) => {
        const panel = dashboard.panels.find((item) => item.department === name);
        return { key: departmentKey(name), name, faults: panel?.total ?? 0, fill: departmentColor(name) };
      }),
    [dashboard],
  );
  const mappedTotal = deptData.reduce((sum, item) => sum + item.faults, 0);

  const deptConfig: ChartConfig = Object.fromEntries(
    deptData.map((item) => [item.key, { label: item.name, color: item.fill }]),
  );
  deptConfig.faults = { label: "Faults", color: "var(--primary)" };

  const trendData = useMemo(
    () =>
      (trend?.weeks ?? []).map((week) => ({
        label: shortWeek(week.label) + (week.partial ? "*" : ""),
        week: week.week,
        fullLabel: week.label,
        selected: week.selected,
        ...Object.fromEntries(DEPARTMENTS.map((name) => [departmentKey(name), week.panels[name] ?? 0])),
      })),
    [trend],
  );
  const selectedLabel = trendData.find((item) => item.selected)?.label;
  const hasPartial = (trend?.weeks ?? []).some((week) => week.partial);

  return (
    <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr_1.4fr]" aria-label="Charts">
      <Card>
        <CardHeader className="pb-0">
          <div>
            <CardTitle>Faults by department</CardTitle>
            <CardDescription className="mt-1">{dashboard.periodLabel}, mapped faults. Select a bar to open its records.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartContainer config={deptConfig} className="aspect-auto h-[250px] w-full">
            <BarChart data={deptData} layout="vertical" margin={{ left: 0, right: 18, top: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ChartTooltipContent />} />              <Bar
                dataKey="faults"
                name="Faults"
                radius={[0, 4, 4, 0]}
                barSize={18}
                isAnimationActive
                animationDuration={700}
                cursor="pointer"
                onClick={(entry) => {
                  const name = (entry as { name?: string }).name;
                  if (name) onDrill(name);
                }}
              >
                {deptData.map((item) => (
                  <Cell key={item.key} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <div>
            <CardTitle>Share of mapped faults</CardTitle>
            <CardDescription className="mt-1">{formatInt(mappedTotal)} faults on a panel. Select a slice or a name.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="relative">
            <ChartContainer config={deptConfig} className="aspect-auto h-[190px] w-full">
              <PieChart>
                <RTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={deptData}
                  dataKey="faults"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                  animationDuration={700}
                  cursor="pointer"
                  onClick={(entry) => {
                    const name = (entry as { name?: string }).name;
                    if (name) onDrill(name);
                  }}
                >
                  {deptData.map((item) => (
                    <Cell key={item.key} fill={item.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-display text-3xl leading-none font-extrabold tabular-nums">{formatInt(mappedTotal)}</div>
                <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">on panels</div>
              </div>
            </div>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {deptData.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onDrill(item.name)}
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  title={"Open " + item.name + " records"}
                >
                  <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.fill }} aria-hidden="true" />
                  <span className="truncate text-muted-foreground">{item.name}</span>
                  <span className="ml-auto font-mono tabular-nums">{formatShare(mappedTotal ? (item.faults / mappedTotal) * 100 : 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 xl:col-span-1">
        <CardHeader className="pb-0">
          <div>
            <CardTitle>Recent weeks by department</CardTitle>
            <CardDescription className="mt-1">
              Eight weeks to the selected period, by Failed Date week{hasPartial ? ". * marks a partial week" : ""}. Select a point to open that week.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {trendLoading && !trend ? (
            <Skeleton className="h-[250px] w-full" />
          ) : trendData.length === 0 ? (
            <div className="grid h-[250px] place-items-center text-sm text-muted-foreground">No weekly history yet.</div>
          ) : (
            <ChartContainer config={deptConfig} className="aspect-auto h-[250px] w-full">
              <LineChart data={trendData} margin={{ left: -8, right: 28, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <RTooltip content={<ChartTooltipContent />} />
                {selectedLabel && <ReferenceLine x={selectedLabel} stroke="var(--primary)" strokeDasharray="4 4" />}
                {deptData.map((item) => (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    name={item.name}
                    stroke={item.fill}
                    strokeWidth={2.25}
                    dot={(dotProps: DotProps) => <TrendDot key={dotProps.index} {...dotProps} color={item.fill} department={item.name} onDrill={onDrill} />}
                    activeDot={false}
                    animationDuration={700}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
