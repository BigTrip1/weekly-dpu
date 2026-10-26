import { Bar, CartesianGrid, ComposedChart, Line, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";

import { getFaultAnalytics, type AnalyticsFilters, type MovementStatus } from "@/api";
import { ChartCard } from "@/components/analytics/ChartCard";
import { StackedBars } from "@/components/analytics/StackedBars";
import type { DrillSpec } from "@/components/analytics/types";
import { useAsync } from "@/components/analytics/useAsync";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt, formatShare } from "@/format";
import { formatDay } from "@/lib/dates";
import { departmentColor } from "@/lib/departments";

type Props = {
  filters: AnalyticsFilters;
  filterKey: string;
  onDrill: (spec: DrillSpec) => void;
};

const paretoConfig: ChartConfig = {
  count: { label: "Faults", color: "var(--primary)" },
  cumulativeShare: { label: "Cumulative share", color: "var(--dept-3)" },
};

const linkClass =
  "cursor-pointer text-left font-semibold underline decoration-border decoration-1 underline-offset-4 transition-colors hover:text-primary-foreground hover:decoration-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:text-primary";

function StatusBadge({ status }: { status: MovementStatus }) {
  if (status === "New") {
    return (
      <Badge variant="warn">
        <SparklesIcon /> New
      </Badge>
    );
  }
  if (status === "Rising") {
    return (
      <Badge variant="up">
        <ArrowUpIcon /> Rising
      </Badge>
    );
  }
  if (status === "Falling") {
    return (
      <Badge variant="down">
        <ArrowDownIcon /> Falling
      </Badge>
    );
  }
  return (
    <Badge variant="flat">
      <MinusIcon /> Steady
    </Badge>
  );
}

type ParetoTooltipProps = {
  active?: boolean;
  payload?: { payload?: { rank: number; fault: string; count: number; cumulativeShare: number } }[];
};

function ParetoTooltip({ active, payload }: ParetoTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="grid max-w-xs gap-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl">
      <div className="font-semibold">
        #{row.rank} {row.fault}
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Faults</span>
        <span className="font-mono font-semibold tabular-nums">{formatInt(row.count)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Cumulative share</span>
        <span className="font-mono font-semibold tabular-nums">{formatShare(row.cumulativeShare)}</span>
      </div>
    </div>
  );
}

export function FaultsTab({ filters, filterKey, onDrill }: Props) {
  const { data, loading, error } = useAsync(() => getFaultAnalytics(filters), `faults|${filterKey}`);
  const empty = !data || data.totalFaults === 0;
  const pareto = (data?.pareto ?? []).map((row, index) => ({ ...row, rank: index + 1 }));
  const coverage = data?.coverage;
  const ruleShare = coverage && coverage.totalFaults ? (coverage.ruleFaults / coverage.totalFaults) * 100 : 0;
  const movement = data?.movement;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      <ChartCard
        title="Fault Pareto"
        description={
          data ? (
            <>
              The top 20 cleansed faults out of {formatInt(data.distinctFaults)} different ones. It takes {formatInt(data.faultsFor80)} of them to reach 80% of {formatInt(data.totalFaults)} faults. Select a bar to open its records.
            </>
          ) : (
            "Cleansed faults by count"
          )
        }
        loading={loading}
        empty={empty}
      >
        <ChartContainer config={paretoConfig} className="aspect-auto h-[300px] w-full">
          <ComposedChart data={pareto} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rank" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="count" tickLine={false} axisLine={false} width={44} />
            <YAxis yAxisId="share" orientation="right" domain={[0, "auto"]} tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => `${Math.round(value)}%`} />
            <RTooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ParetoTooltip />} />
            <Bar
              yAxisId="count"
              dataKey="count"
              name="Faults"
              fill="var(--primary)"
              radius={[3, 3, 0, 0]}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(entry) => {
                const fault = (entry as { fault?: string }).fault;
                if (fault) onDrill({ eyebrow: "Cleansed fault", title: fault, query: { cleansedFault: fault } });
              }}
            />
            <Line yAxisId="share" type="monotone" dataKey="cumulativeShare" name="Cumulative share" stroke="var(--dept-3)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
      </ChartCard>

      <section aria-label="Fault movement" className="flex flex-col gap-3">
        <div>
          <h3 className="font-display text-2xl leading-none font-extrabold tracking-wide uppercase">Fault movement</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {movement?.recentFrom && movement.recentTo && movement.priorFrom && movement.priorTo
              ? `The 4 weeks to ${formatDay(movement.recentTo)} (from ${formatDay(movement.recentFrom)}) against the 4 weeks before (${formatDay(movement.priorFrom)} to ${formatDay(movement.priorTo)}). The end date above sets where the comparison finishes, and the start date has no effect on it. Mapped faults only, with at least 5 in the two windows combined.`
              : "Four weeks against the four weeks before."}
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {(movement?.departments ?? []).map((group) => (
            <Card key={group.department} className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
                <span className="size-3 rounded-[3px]" style={{ backgroundColor: departmentColor(group.department) }} aria-hidden="true" />
                <h4 className="font-display text-lg leading-none font-extrabold tracking-wide uppercase">{group.department}</h4>
              </div>
              {group.rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{loading ? "Loading" : "Nothing to compare for this department."}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Cleansed fault</TableHead>
                      <TableHead className="text-right">Before</TableHead>
                      <TableHead className="text-right">Latest</TableHead>
                      <TableHead className="text-center">Movement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow key={row.fault}>
                        <TableCell className="max-w-[18rem]">
                          <button
                            type="button"
                            className={linkClass}
                            onClick={() =>
                              onDrill({
                                eyebrow: group.department,
                                color: departmentColor(group.department),
                                title: row.fault,
                                query: { cleansedFault: row.fault, department: group.department },
                              })
                            }
                          >
                            {row.fault}
                          </button>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground tabular-nums">{formatInt(row.prior)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">{formatInt(row.recent)}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={row.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          ))}
        </div>
      </section>

      <ChartCard
        title="Failed To against department"
        description={
          data ? (
            <>
              The {Math.min(25, data.failedToCount)} biggest of {formatInt(data.failedToCount)} Failed To values, coloured by the department each one maps to. A grey bar is hidden or unmapped.
            </>
          ) : (
            "Which Failed To values feed each panel"
          )
        }
        loading={loading}
        empty={empty}
      >
        {data && (
          <StackedBars
            rows={data.failedTo.map((row) => ({ label: row.failedTo, total: row.total, departments: row.departments }))}
            departments={data.departments}
            labelWidth={150}
            onSelect={(label, department) =>
              onDrill({
                eyebrow: department,
                color: departmentColor(department),
                title: `Failed To ${label}`,
                query: { failedTo: label, department },
              })
            }
          />
        )}
      </ChartCard>

      <ChartCard
        title="Cleansing coverage"
        description="How many faults were named by a cleansing rule, against faults that only had their comment tidied. More rule coverage means fewer split names for the same problem."
        loading={loading}
        empty={empty}
      >
        {coverage && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">Named by a rule</span>
                  <span className="font-mono tabular-nums">
                    {formatInt(coverage.ruleFaults)} of {formatInt(coverage.totalFaults)} ({formatShare(ruleShare)})
                  </span>
                </div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${formatShare(ruleShare)} of faults were named by a rule`}>
                  <div className="h-full bg-primary" style={{ width: `${ruleShare}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatInt(coverage.fallbackFaults)} faults kept their tidied comment as the name. There are {formatInt(coverage.distinctFaults)} distinct fault names in this range.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Rules that name the most faults</h4>
                <Table>
                  <TableBody>
                    {coverage.topRules.map((row) => (
                      <TableRow key={row.fault}>
                        <TableCell>
                          <button type="button" className={linkClass} onClick={() => onDrill({ eyebrow: "Cleansing rule", title: row.fault, query: { cleansedFault: row.fault } })}>
                            {row.fault}
                          </button>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatInt(row.count)}</TableCell>
                      </TableRow>
                    ))}
                    {coverage.topRules.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="text-muted-foreground">No rule has named a fault in this range.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Most ways of writing the same fault</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Cleansed fault</TableHead>
                    <TableHead className="text-right">Faults</TableHead>
                    <TableHead className="text-right">Different raw comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverage.variants.map((row) => (
                    <TableRow key={row.fault}>
                      <TableCell className="max-w-[16rem]">
                        <button type="button" className={linkClass} onClick={() => onDrill({ eyebrow: "Raw comments", title: row.fault, query: { cleansedFault: row.fault } })}>
                          {row.fault}
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatInt(row.faults)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">{formatInt(row.rawComments)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
