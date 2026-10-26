import type { Db, Filter } from "mongodb";
import { addDays, formatMonth, formatWeek, previousMonth, weekEnd } from "./dates.js";
import { shutdownMap } from "./shutdowns.js";
import { PANELS } from "./types.js";

type PeriodMatch = Filter<Record<string, unknown>>;

export async function getPeriods(db: Db) {
  const rows = await db
    .collection("faults")
    .aggregate<{ _id: { month: string; week: string }; faults: number }>([
      { $group: { _id: { month: "$month", week: "$weekCommencing" }, faults: { $sum: 1 } } },
      { $sort: { "_id.month": 1, "_id.week": 1 } },
    ])
    .toArray();

  const shutdowns = await shutdownMap(db);
  type WeekOption = { week: string; label: string; faults: number; shutdown: string | null };
  const months = new Map<string, { month: string; label: string; weeks: WeekOption[] }>();
  for (const row of rows) {
    const month = row._id.month;
    const week = row._id.week;
    if (!month || !week) continue;
    const entry = months.get(month) ?? { month, label: formatMonth(month), weeks: [] };
    entry.weeks.push({ week, label: formatWeek(week), faults: row.faults, shutdown: shutdowns.get(week) ?? null });
    months.set(month, entry);
  }
  const yearRows = await db
    .collection("faults")
    .aggregate<{ _id: string; max: string }>([
      { $match: { failedDate: { $regex: /^\d{4}-\d{2}-\d{2}$/ } } },
      { $group: { _id: { $substr: ["$failedDate", 0, 4] }, max: { $max: "$failedDate" } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  // One entry per year in the data, newest last. The newest year is year to date. An earlier year is the full year.
  const years = yearRows.map((row, index) => {
    const year = Number(row._id);
    const current = index === yearRows.length - 1;
    return {
      year,
      current,
      ytd: {
        value: `ytd-${year}`,
        year,
        label: current ? `Year to date ${year}` : `Full year ${year}`,
        from: `${year}-01-01`,
        to: row.max,
      },
    };
  });
  return { months: [...months.values()], years };
}

export async function getDashboard(db: Db, month: string, week: string) {
  const currentMatch = matchFor(month, week);
  const ytdYear = ytdYearOf(month);
  const comparison = ytdYear ? await ytdComparison(db, ytdYear) : comparisonFor(month, week);
  const [current, previous] = await Promise.all([
    loadPeriod(db, currentMatch),
    loadPeriod(db, comparison.match),
  ]);

  const comparable = previous.totals.faults > 0;
  const previousByKey = new Map(previous.groups.map((group) => [group.key, group.count]));
  const previousDept = previous.deptTotals;

  const panels = PANELS.map((department) => {
    const rows = current.groups
      .filter((group) => group.department === department)
      .sort((a, b) => b.count - a.count || a.fault.localeCompare(b.fault))
      .slice(0, 10)
      .map((group) => {
        const departmentTotal = current.deptTotals.get(department) ?? 0;
        const share = departmentTotal ? (group.count / departmentTotal) * 100 : 0;
        if (!comparable) {
          return {
            cleansedFault: group.fault,
            count: group.count,
            previousCount: null,
            trend: null,
            share,
            previousShare: null,
            shareChange: null,
          };
        }
        const previousCount = previousByKey.get(group.key) ?? 0;
        const previousTotal = previousDept.get(department) ?? 0;
        const previousShare = previousTotal ? (previousCount / previousTotal) * 100 : 0;
        return {
          cleansedFault: group.fault,
          count: group.count,
          previousCount,
          trend: group.count - previousCount,
          share,
          previousShare,
          shareChange: share - previousShare,
        };
      });
    return {
      department,
      total: current.deptTotals.get(department) ?? 0,
      rows,
    };
  });

  const partial = !ytdYear && week !== "all" && isPartialWeek(week, current.totals.minDate, current.totals.maxDate);
  const yearLabel = ytdYear ? await ytdLabel(db, ytdYear) : "";

  return {
    month,
    week,
    monthLabel: ytdYear ? yearLabel : formatMonth(month),
    periodLabel: ytdYear ? yearLabel : week === "all" ? formatMonth(month) : formatWeek(week),
    view: ytdYear ? "ytd" : week === "all" ? "monthly" : "weekly",
    partial,
    comparisonLabel: comparison.label,
    comparisonAvailable: comparable,
    totals: {
      faults: current.totals.faults,
      uniqueBuilds: current.totals.uniqueBuilds,
      faultsPerBuild: current.totals.uniqueBuilds ? current.totals.faults / current.totals.uniqueBuilds : null,
      unmapped: current.totals.unmapped,
      hidden: current.totals.hidden,
    },
    previousTotals: comparable
      ? {
          faults: previous.totals.faults,
          uniqueBuilds: previous.totals.uniqueBuilds,
          faultsPerBuild: previous.totals.uniqueBuilds ? previous.totals.faults / previous.totals.uniqueBuilds : null,
        }
      : null,
    panels,
  };
}

const TREND_WEEKS = 8;

// Weekly panel totals for the weeks leading up to the end of the selected month.
// Weeks are Failed Date weeks (Monday start). Panel counts use mapped faults only.
export async function getTrend(db: Db, month: string, week: string) {
  const weeks = await db
    .collection("faults")
    .aggregate<{ _id: string }>([
      { $group: { _id: "$weekCommencing" } },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const all = weeks.map((row) => row._id).filter((value) => value);
  if (!all.length) return { weeks: [], panels: PANELS, skipped: [], year: periodYear(month) };

  const year = periodYear(month);
  const yearPrefix = `${year}-`;
  const shutdowns = await shutdownMap(db);

  // Year to date has no single month, so the trend ends on the newest week of that year.
  const monthWeeks = ytdYearOf(month) ? [] : await db.collection("faults").distinct("weekCommencing", { month });
  const lastInMonth = [...monthWeeks].filter((value) => value).sort().pop() as string | undefined;
  const lastInYear = [...all].filter((value) => value.startsWith(yearPrefix)).pop();
  const requested = week !== "all" && all.includes(week) ? week : lastInMonth ?? lastInYear ?? all[all.length - 1];

  // The chart only holds weeks that commence in the selected year, so a new year starts a fresh chart.
  // Shutdown weeks are left out. A week picked from the previous year's end is still shown when it was chosen on purpose.
  const working = all.filter((value) => !shutdowns.has(value) && (value.startsWith(yearPrefix) || value === requested));
  const upTo = working.filter((value) => value <= requested);
  const picked = upTo.slice(-TREND_WEEKS);
  const anchor = shutdowns.has(requested) ? "" : requested;
  const skipped = picked.length
    ? [...shutdowns.entries()]
        .filter(([value]) => value > picked[0] && value <= requested && value.startsWith(yearPrefix))
        .map(([value, reason]) => ({ week: value, label: formatWeek(value), reason }))
    : [];

  const rows = await db
    .collection("faults")
    .aggregate<{ _id: { week: string; dept: string | null }; count: number; minDate: string; maxDate: string }>([
      { $match: { weekCommencing: { $in: picked } } },
      {
        $group: {
          _id: { week: "$weekCommencing", dept: { $cond: ["$showOnPanel", "$executiveDepartment", null] } },
          count: { $sum: 1 },
          minDate: { $min: "$failedDate" },
          maxDate: { $max: "$failedDate" },
        },
      },
    ])
    .toArray();

  const byWeek = new Map<string, { total: number; minDate: string; maxDate: string; panels: Record<string, number> }>();
  for (const row of rows) {
    const entry = byWeek.get(row._id.week) ?? { total: 0, minDate: row.minDate, maxDate: row.maxDate, panels: {} };
    entry.total += row.count;
    if (row.minDate < entry.minDate) entry.minDate = row.minDate;
    if (row.maxDate > entry.maxDate) entry.maxDate = row.maxDate;
    if (row._id.dept) entry.panels[row._id.dept] = (entry.panels[row._id.dept] ?? 0) + row.count;
    byWeek.set(row._id.week, entry);
  }

  return {
    panels: PANELS,
    year,
    skipped,
    weeks: picked.map((value) => {
      const entry = byWeek.get(value);
      return {
        week: value,
        label: formatWeek(value),
        total: entry?.total ?? 0,
        partial: entry ? isPartialWeek(value, entry.minDate, entry.maxDate) : false,
        selected: value === anchor,
        panels: Object.fromEntries(PANELS.map((name) => [name, entry?.panels[name] ?? 0])),
      };
    }),
  };
}

function isPartialWeek(week: string, minDate: string | null, maxDate: string | null): boolean {
  if (!minDate || !maxDate) return false;
  return minDate > week || maxDate < weekEnd(week);
}

const YTD = /^ytd-(\d{4})$/;

// The year a period token belongs to: 2026-10 and ytd-2026 are both 2026.
function periodYear(month: string): number {
  return ytdYearOf(month) ?? Number(month.slice(0, 4));
}

function ytdYearOf(month: string): number | null {
  const found = YTD.exec(month);
  return found ? Number(found[1]) : null;
}

// The newest year in the data is year to date. Any earlier year is a full year.
async function ytdLabel(db: Db, year: number): Promise<string> {
  const [newest] = await db
    .collection("faults")
    .aggregate<{ max: string }>([
      { $match: { failedDate: { $regex: /^\d{4}-\d{2}-\d{2}$/ } } },
      { $group: { _id: null, max: { $max: "$failedDate" } } },
    ])
    .toArray();
  return Number(newest?.max?.slice(0, 4)) === year ? `Year to date ${year}` : `Full year ${year}`;
}

// The same calendar days of the year before, so a year to date total is compared like for like.
async function ytdComparison(db: Db, year: number): Promise<{ match: PeriodMatch; label: string }> {
  const [latest] = await db
    .collection("faults")
    .aggregate<{ max: string }>([
      { $match: { failedDate: { $gte: `${year}-01-01`, $lt: `${year + 1}-01-01` } } },
      { $group: { _id: null, max: { $max: "$failedDate" } } },
    ])
    .toArray();
  const monthDay = (latest?.max ?? `${year}-12-31`).slice(5);
  return {
    match: { failedDate: { $gte: `${year - 1}-01-01`, $lte: `${year - 1}-${monthDay}` } },
    label: `Same period ${year - 1}`,
  };
}

function matchFor(month: string, week: string): PeriodMatch {
  const ytdYear = ytdYearOf(month);
  if (ytdYear) return { failedDate: { $gte: `${ytdYear}-01-01`, $lt: `${ytdYear + 1}-01-01` } };
  if (week === "all") return { month };
  return { month, weekCommencing: week };
}

function comparisonFor(month: string, week: string): { match: PeriodMatch; label: string } {
  if (week === "all") {
    const previous = previousMonth(month);
    return { match: { month: previous }, label: formatMonth(previous) };
  }
  const previousWeek = addDays(week, -7);
  return { match: { weekCommencing: previousWeek }, label: formatWeek(previousWeek) };
}

type GroupRow = { key: string; department: string; fault: string; count: number };

async function loadPeriod(db: Db, match: PeriodMatch) {
  const [totalsRow] = await db
    .collection("faults")
    .aggregate<{
      faults: number;
      builds: string[];
      unmapped: number;
      hidden: number;
      minDate: string | null;
      maxDate: string | null;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          faults: { $sum: 1 },
          builds: { $addToSet: "$buildNumber" },
          unmapped: { $sum: { $cond: [{ $eq: ["$mappingStatus", "unmapped"] }, 1, 0] } },
          hidden: { $sum: { $cond: [{ $eq: ["$mappingStatus", "hidden"] }, 1, 0] } },
          minDate: { $min: "$failedDate" },
          maxDate: { $max: "$failedDate" },
        },
      },
    ])
    .toArray();

  const grouped = await db
    .collection("faults")
    .aggregate<{ _id: { dept: string; fault: string }; count: number }>([
      { $match: { ...match, showOnPanel: true } },
      { $group: { _id: { dept: "$executiveDepartment", fault: "$cleansedFault" }, count: { $sum: 1 } } },
    ])
    .toArray();

  const groups: GroupRow[] = grouped
    .filter((row) => row._id.dept && row._id.fault)
    .map((row) => ({
      key: `${row._id.dept}||${row._id.fault}`,
      department: row._id.dept,
      fault: row._id.fault,
      count: row.count,
    }));

  const deptTotals = new Map<string, number>();
  for (const group of groups) deptTotals.set(group.department, (deptTotals.get(group.department) ?? 0) + group.count);

  const builds = (totalsRow?.builds ?? []).filter((build) => build);
  return {
    totals: {
      faults: totalsRow?.faults ?? 0,
      uniqueBuilds: builds.length,
      unmapped: totalsRow?.unmapped ?? 0,
      hidden: totalsRow?.hidden ?? 0,
      minDate: totalsRow?.minDate ?? null,
      maxDate: totalsRow?.maxDate ?? null,
    },
    groups,
    deptTotals,
  };
}

export async function getDrilldown(
  db: Db,
  month: string,
  week: string,
  department: string,
  cleansedFault: string,
) {
  const filter = {
    ...(month ? matchFor(month, week) : { weekCommencing: week }),
    showOnPanel: true,
    executiveDepartment: department,
    ...(cleansedFault ? { cleansedFault } : {}),
  };
  return loadRecords(db, filter);
}

// Source rows behind a count. Shared by the dashboard drill-down and the Analytics page.
export async function loadRecords(db: Db, filter: Filter<Record<string, unknown>>) {
  const total = await db.collection("faults").countDocuments(filter);
  const rows = await db
    .collection("faults")
    .find(filter)
    .project({
      sourceRow: 1,
      orderNumber: 1,
      buildNumber: 1,
      serialNumber: 1,
      model: 1,
      workCenter: 1,
      checkText: 1,
      comments: 1,
      cleansedFault: 1,
      failedTo: 1,
      executiveDepartment: 1,
      machineArea: 1,
      defectType: 1,
      failedBy: 1,
      failedDate: 1,
      failedTime: 1,
      fixedDate: 1,
      fixedTime: 1,
      closureStatus: 1,
      fix: 1,
    })
    .sort({ failedDate: 1, buildNumber: 1, sourceRow: 1 })
    .limit(5000)
    .toArray();

  return {
    total,
    rows: rows.map((row) => ({
      id: String(row._id),
      sourceRow: row.sourceRow ?? null,
      orderNumber: row.orderNumber ?? "",
      buildNumber: row.buildNumber ?? "",
      serialNumber: row.serialNumber ?? "",
      model: row.model ?? "",
      workCenter: row.workCenter ?? "",
      checkText: row.checkText ?? "",
      comments: row.comments ?? "",
      cleansedFault: row.cleansedFault ?? "",
      failedTo: row.failedTo ?? "",
      executiveDepartment: row.executiveDepartment ?? "",
      machineArea: row.machineArea ?? "",
      defectType: row.defectType ?? "",
      failedBy: row.failedBy ?? "",
      failedDate: row.failedDate ?? "",
      failedTime: row.failedTime ?? "",
      fixedDate: row.fixedDate ?? "",
      fixedTime: row.fixedTime ?? "",
      closureStatus: row.closureStatus ?? "",
      fix: row.fix ?? "",
    })),
  };
}
