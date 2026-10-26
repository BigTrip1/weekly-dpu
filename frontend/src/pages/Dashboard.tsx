import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownIcon, ArrowUpIcon, CalendarDaysIcon, CalendarRangeIcon, MinusIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";

import {
  getDashboard,
  getFaults,
  getPeriods,
  getTrend,
  type DashboardResponse,
  type DrillRow,
  type MonthOption,
  type TrendResponse,
  type YearOption,
} from "@/api";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DepartmentPanel } from "@/components/dashboard/DepartmentPanel";
import { DrillSheet } from "@/components/dashboard/DrillSheet";
import CountUp from "@/components/reactbits/CountUp";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { departmentColor } from "@/lib/departments";

function deltaBadge(current: number, previous: number | null | undefined, percent: boolean) {
  if (previous == null) return <Badge variant="flat">No comparison</Badge>;
  const diff = current - previous;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const Icon = diff > 0 ? ArrowUpIcon : diff < 0 ? ArrowDownIcon : MinusIcon;
  let text: string;
  if (percent) {
    const pct = previous ? (diff / previous) * 100 : 0;
    text = `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  } else {
    text = `${diff > 0 ? "+" : ""}${Number.isInteger(diff) ? diff : diff.toFixed(2)}`;
  }
  return (
    <Badge variant={direction} className="font-mono tabular-nums">
      <Icon aria-hidden="true" /> {text}
    </Badge>
  );
}

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [years, setYears] = useState<YearOption[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [drillRows, setDrillRows] = useState<DrillRow[] | null>(null);
  const [drillTotal, setDrillTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);

  const month = params.get("month") ?? "";
  const week = params.get("week") ?? "";
  const drillDept = params.get("department") ?? "";
  const drillFault = params.get("fault") ?? "";
  // Set when a point on the weekly trend chart was selected. The records then follow that week alone.
  const drillWeek = params.get("dweek") ?? "";
  const drillWeekLabel = params.get("dlabel") ?? "";

  useEffect(() => {
    let active = true;
    getPeriods()
      .then((result) => {
        if (!active) return;
        setMonths(result.months);
        setYears(result.years);
        if (!result.months.length) {
          setLoading(false);
          return;
        }
        // A year link keeps its period when that year is still in the data.
        if (result.years.some((item) => item.ytd.value === month) && week === "all") return;
        const requested = result.months.find((item) => item.month === month) ?? result.months[result.months.length - 1];
        const weekIsKnown = week === "all" || requested.weeks.some((item) => item.week === week);
        if (month && week && weekIsKnown && requested.month === month) return;
        const busiest = requested.weeks.reduce((best, item) => (item.faults > best.faults ? item : best), requested.weeks[0]);
        const next = new URLSearchParams(params);
        next.set("month", requested.month);
        next.set("week", busiest.week);
        setParams(next, { replace: true });
      })
      .catch((reason: Error) => {
        if (active) {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // Default the period once. Later changes come from the selectors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!month || !week) return;
    let active = true;
    setLoading(true);
    setError("");
    getDashboard(month, week)
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, week]);

  useEffect(() => {
    if (!month || !week) return;
    let active = true;
    setTrendLoading(true);
    getTrend(month, week)
      .then((result) => {
        if (active) setTrend(result);
      })
      .catch(() => {
        if (active) setTrend(null);
      })
      .finally(() => {
        if (active) setTrendLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, week]);

  useEffect(() => {
    if (!month || !week || !drillDept) {
      setDrillRows(null);
      return;
    }
    let active = true;
    setDrillLoading(true);
    const request = drillWeek ? getFaults("", drillWeek, drillDept, drillFault) : getFaults(month, week, drillDept, drillFault);
    request
      .then((result) => {
        if (!active) return;
        setDrillRows(result.rows);
        setDrillTotal(result.total);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setDrillLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, week, drillDept, drillFault, drillWeek]);

  const selectedMonth = useMemo(() => months.find((item) => item.month === month), [months, month]);

  // The year follows the period in the address: 2026-10 and ytd-2026 are both 2026.
  const year = Number(month.startsWith("ytd-") ? month.slice(4) : month.slice(0, 4)) || 0;
  const yearChoices = useMemo(() => [...years].sort((a, b) => b.year - a.year), [years]);
  const yearOption = years.find((item) => item.year === year) ?? null;
  const yearMonths = useMemo(() => months.filter((item) => item.month.startsWith(`${year}-`)), [months, year]);

  function busiestWeek(option: MonthOption) {
    return option.weeks.reduce((best, item) => (item.faults > best.faults ? item : best), option.weeks[0]);
  }

  // Changing the year starts that year's own view: its newest month, or the whole year when year to date is on.
  function chooseYear(nextYear: number) {
    const target = years.find((item) => item.year === nextYear);
    if (!target) return;
    if (isYtd) {
      updatePeriod(target.ytd.value, "all");
      return;
    }
    const inYear = months.filter((item) => item.month.startsWith(`${nextYear}-`));
    const latest = inYear[inYear.length - 1];
    if (latest) updatePeriod(latest.month, busiestWeek(latest).week);
    else updatePeriod(target.ytd.value, "all");
  }

  function updatePeriod(nextMonth: string, nextWeek: string) {
    const next = new URLSearchParams(params);
    next.set("month", nextMonth);
    next.set("week", nextWeek);
    clearDrill(next);
    setParams(next);
  }

  function clearDrill(next: URLSearchParams) {
    next.delete("department");
    next.delete("fault");
    next.delete("dweek");
    next.delete("dlabel");
  }

  function openDrill(department: string, fault: string) {
    const next = new URLSearchParams(params);
    clearDrill(next);
    next.set("department", department);
    next.set("fault", fault);
    setParams(next);
  }

  // Chart marks open every fault on that panel. A trend point narrows it to one week.
  function openChartDrill(department: string, pickedWeek?: { week: string; label: string }) {
    const next = new URLSearchParams(params);
    clearDrill(next);
    next.set("department", department);
    if (pickedWeek) {
      next.set("dweek", pickedWeek.week);
      next.set("dlabel", pickedWeek.label);
    }
    setParams(next);
  }

  function closeDrill() {
    const next = new URLSearchParams(params);
    clearDrill(next);
    setParams(next);
  }

  if (!loading && !months.length && !error) {
    return (
      <main className="mx-auto grid max-w-xl place-items-center px-6 py-24 text-center">
        <Card className="items-center gap-4 p-10">
          <div className="grid size-14 place-items-center rounded-xl bg-primary text-primary-foreground">
            <UploadIcon className="size-7" />
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-wide uppercase">No faults loaded yet</h2>
          <p className="text-sm text-muted-foreground">
            Upload the weekly faults extract. Exact copies are skipped, and a later file can refresh closure details without counting the same fault twice.
          </p>
          <Button asChild>
            <Link to="/upload">Upload faults</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const isYtd = month.startsWith("ytd-");
  const view = dashboard?.view ?? "weekly";
  const fullYear = view === "ytd" && Boolean(dashboard?.periodLabel.startsWith("Full year"));
  const viewName =
    view === "ytd" ? (fullYear ? "Full year view" : "Year to date view") : view === "monthly" ? "Monthly view" : "Weekly view";
  const previousLabel = view === "ytd" ? "Prev year QTY" : view === "monthly" ? "Prev month QTY" : "Prev week QTY";

  // Back from the year view to the busiest week of the newest month in that year.
  function leaveYtd() {
    const latest = yearMonths[yearMonths.length - 1];
    if (!latest) return;
    updatePeriod(latest.month, busiestWeek(latest).week);
  }

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6">
      <section
        aria-label="Period filters"
        className="z-30 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card p-2.5 shadow-sm md:sticky md:top-[77px]"
      >
        <div className="flex items-center gap-2.5">
          <label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Year</label>
          <Select value={year ? String(year) : undefined} onValueChange={(next) => chooseYear(Number(next))}>
            <SelectTrigger aria-label="Year" className="min-w-[6.5rem]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearChoices.map((item) => (
                <SelectItem key={item.year} value={String(item.year)}>
                  {item.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[12rem] items-center gap-2.5">
          <label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Month</label>
          <Select
            value={isYtd ? undefined : month || undefined}
            onValueChange={(nextMonth) => {
              const option = months.find((item) => item.month === nextMonth);
              updatePeriod(nextMonth, option ? busiestWeek(option).week : "all");
            }}
          >
            <SelectTrigger aria-label="Month">
              <SelectValue placeholder={isYtd ? "Not used for the year view" : "Choose a month"} />
            </SelectTrigger>
            <SelectContent>
              {yearMonths.map((item) => (
                <SelectItem key={item.month} value={item.month}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[14rem] items-center gap-2.5">
          <label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Week</label>
          <Select value={isYtd ? "all" : week || undefined} onValueChange={(nextWeek) => updatePeriod(month, nextWeek)} disabled={isYtd}>
            <SelectTrigger aria-label="Week">
              <SelectValue placeholder="Choose a week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All weeks</SelectItem>
              {selectedMonth?.weeks.map((item) => (
                <SelectItem key={item.week} value={item.week}>
                  {item.label}
                  {item.shutdown ? ` (${item.shutdown})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {yearOption && (
          <Button
            type="button"
            size="sm"
            variant={isYtd ? "default" : "outline"}
            aria-pressed={isYtd}
            onClick={() => (isYtd ? leaveYtd() : updatePeriod(yearOption.ytd.value, "all"))}
            title={`${yearOption.ytd.label}: 1 Jan to ${yearOption.ytd.to}`}
          >
            <CalendarRangeIcon /> {yearOption.current ? "Year to date" : "Full year"}
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant="default" className="h-7 gap-1.5 px-2.5 text-xs tracking-wider uppercase">
            <CalendarDaysIcon /> {dashboard ? viewName : "Loading"}
          </Badge>
          {dashboard && (
            <span className="text-xs text-muted-foreground">
              Trend vs <strong className="font-semibold text-foreground">{dashboard.comparisonLabel}</strong>
              {!dashboard.comparisonAvailable && " (no faults to compare)"}
            </span>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      {loading && !dashboard && (
        <div className="grid gap-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {dashboard && (
        <div className={loading ? "flex flex-col gap-4 opacity-70 transition-opacity" : "flex flex-col gap-4 transition-opacity"}>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
            <SpotlightCard className="p-5">
              <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Total faults</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <CountUp to={dashboard.totals.faults} className="font-display text-5xl leading-none font-extrabold tabular-nums" />
                {deltaBadge(dashboard.totals.faults, dashboard.previousTotals?.faults, true)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Includes unmapped and hidden faults</p>
            </SpotlightCard>
            <SpotlightCard className="p-5">
              <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Unique builds</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <CountUp to={dashboard.totals.uniqueBuilds} className="font-display text-5xl leading-none font-extrabold tabular-nums" />
                {deltaBadge(dashboard.totals.uniqueBuilds, dashboard.previousTotals?.uniqueBuilds, true)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Distinct build numbers in the extract</p>
            </SpotlightCard>
            <SpotlightCard className="p-5">
              <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Faults / build</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                {dashboard.totals.faultsPerBuild == null ? (
                  <span className="font-display text-5xl leading-none font-extrabold">—</span>
                ) : (
                  <CountUp to={dashboard.totals.faultsPerBuild} decimals={2} className="font-display text-5xl leading-none font-extrabold tabular-nums" />
                )}
                {dashboard.totals.faultsPerBuild != null && deltaBadge(dashboard.totals.faultsPerBuild, dashboard.previousTotals?.faultsPerBuild, false)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Lower is better</p>
            </SpotlightCard>
            <SpotlightCard className="p-5">
              <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Period status</p>
              <p className="mt-2 font-display text-3xl leading-none font-extrabold tracking-wide uppercase">{viewName}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {dashboard.periodLabel}
                {dashboard.partial && (
                  <Badge variant="warn" className="ml-2">
                    Partial week
                  </Badge>
                )}
              </p>
            </SpotlightCard>
          </section>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground" aria-label="Trend legend">
            <li className="font-semibold text-foreground">Trend vs {dashboard.comparisonLabel}</li>
            <li className="flex items-center gap-1.5"><Badge variant="up"><ArrowUpIcon /></Badge> Count increased</li>
            <li className="flex items-center gap-1.5"><Badge variant="down"><ArrowDownIcon /></Badge> Count reduced</li>
            <li className="flex items-center gap-1.5"><Badge variant="flat"><MinusIcon /></Badge> No change</li>
            <li className="flex items-center gap-1.5"><Badge variant="flat">—</Badge> No comparison</li>
          </ul>

          <DashboardCharts dashboard={dashboard} trend={trend} trendLoading={trendLoading} onDrill={openChartDrill} />

          <section className="grid gap-4 xl:grid-cols-2" aria-label="Executive panels">
            {dashboard.panels.map((panel) => (
              <DepartmentPanel key={panel.department} panel={panel} periodTotal={dashboard.totals.faults} previousLabel={previousLabel} onOpen={openDrill} />
            ))}
          </section>

          <footer className="px-1 pb-6 text-xs leading-relaxed text-muted-foreground">
            POF definition: all point-of-fit shortages and all faults assigned to Materials. Fault descriptions are cleansed versions of the inspector comments. Lower faults per build indicates improvement, subject to the available denominator. Faults per build divides recorded faults by distinct build numbers in the extract. Machines with no recorded faults are not in that denominator.
          </footer>
        </div>
      )}

      <DrillSheet
        open={Boolean(drillDept)}
        eyebrow={drillDept}
        color={departmentColor(drillDept)}
        title={drillFault || `All ${drillDept} faults`}
        periodLabel={drillWeek ? drillWeekLabel || drillWeek : dashboard?.periodLabel ?? ""}
        rows={drillRows}
        total={drillTotal}
        loading={drillLoading}
        onClose={closeDrill}
      />
    </main>
  );
}
