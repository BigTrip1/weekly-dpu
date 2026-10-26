import type { Db, Document, Filter } from "mongodb";
import { addDays } from "./dates.js";
import { loadRules } from "./reporting.js";
import { shutdownMap } from "./shutdowns.js";
import { PANELS } from "./types.js";

// Read-only aggregations for the Analytics page. Nothing here writes to the database.
// failed_by is never grouped or returned as a measure, so no view can rank people.

export const OFF_PANEL = "Off panel";
const BLANK = "(blank)";
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type AnalyticsFilters = {
  from?: string;
  to?: string;
  department?: string;
  model?: string;
  workCenter?: string;
};

export type RecordFilters = AnalyticsFilters & {
  machineArea?: string;
  defectType?: string;
  failedTo?: string;
  cleansedFault?: string;
  hour?: string;
  weekday?: string;
  week?: string;
  month?: string;
};

type Match = Filter<Document>;

// A blank label in a chart stands for an empty or missing value in the data.
function equalsLabel(field: string, value: string): Match {
  return value === BLANK ? { [field]: { $in: ["", null] } } : { [field]: value };
}

function baseMatch(filters: AnalyticsFilters, options: { dates?: boolean } = {}): Match {
  const match: Match = {};
  if (options.dates !== false && (filters.from || filters.to)) {
    match.failedDate = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  if (filters.department) {
    if (filters.department === OFF_PANEL) match.showOnPanel = { $ne: true };
    else {
      match.showOnPanel = true;
      match.executiveDepartment = filters.department;
    }
  }
  if (filters.model) Object.assign(match, equalsLabel("model", filters.model));
  if (filters.workCenter) Object.assign(match, equalsLabel("workCenter", filters.workCenter));
  return match;
}

const deptExpr = { $cond: ["$showOnPanel", "$executiveDepartment", OFF_PANEL] };
const blankTo = (field: string) => ({ $cond: [{ $in: [field, ["", null]] }, BLANK, field] });
// Mongo numbers Sunday as 1. This gives Monday as 0 and Sunday as 6.
const weekdayExpr = {
  $mod: [{ $add: [{ $dayOfWeek: { $dateFromString: { dateString: "$failedDate", onError: null } } }, 5] }, 7],
};
const hourExpr = { $substrBytes: ["$failedTime", 0, 2] };

export async function getAnalyticsMeta(db: Db) {
  const faults = db.collection("faults");
  const [range] = await faults
    .aggregate<{ min: string | null; max: string | null; total: number }>([
      { $group: { _id: null, min: { $min: "$failedDate" }, max: { $max: "$failedDate" }, total: { $sum: 1 } } },
    ])
    .toArray();
  const [models, workCenters] = await Promise.all([faults.distinct("model"), faults.distinct("workCenter")]);
  const clean = (values: unknown[]) =>
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  return {
    min: range?.min ?? null,
    max: range?.max ?? null,
    total: range?.total ?? 0,
    models: clean(models),
    workCenters: clean(workCenters),
    departments: [...PANELS, OFF_PANEL],
  };
}

type StackRow = { label: string; total: number; departments: Record<string, number> };

// Groups by one field and splits each group by department. Keeps the biggest groups.
async function stackedByDepartment(db: Db, match: Match, label: unknown, limit: number): Promise<StackRow[]> {
  const rows = await db
    .collection("faults")
    .aggregate<{ _id: { label: string; dept: string }; count: number }>([
      { $match: match },
      { $group: { _id: { label, dept: deptExpr }, count: { $sum: 1 } } },
    ])
    .toArray();
  const byLabel = new Map<string, StackRow>();
  for (const row of rows) {
    const name = String(row._id.label ?? BLANK);
    const entry = byLabel.get(name) ?? { label: name, total: 0, departments: {} };
    entry.total += row.count;
    const dept = row._id.dept ?? OFF_PANEL;
    entry.departments[dept] = (entry.departments[dept] ?? 0) + row.count;
    byLabel.set(name, entry);
  }
  return [...byLabel.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, limit);
}

export async function getPatterns(db: Db, filters: AnalyticsFilters) {
  const match = baseMatch(filters);
  const faults = db.collection("faults");

  const [totalRow, cells, models, hourRows, weekdayRows, defectMix, workCentres] = await Promise.all([
    faults
      .aggregate<{ faults: number; builds: string[] }>([
        { $match: match },
        { $group: { _id: null, faults: { $sum: 1 }, builds: { $addToSet: "$buildNumber" } } },
      ])
      .toArray(),
    faults
      .aggregate<{ _id: { area: string; defect: string }; count: number }>([
        { $match: match },
        { $group: { _id: { area: blankTo("$machineArea"), defect: blankTo("$defectType") }, count: { $sum: 1 } } },
      ])
      .toArray(),
    faults
      .aggregate<{ _id: string; faults: number; builds: number }>([
        { $match: match },
        { $group: { _id: blankTo("$model"), faults: { $sum: 1 }, builds: { $addToSet: "$buildNumber" } } },
        { $project: { faults: 1, builds: { $size: "$builds" } } },
        { $sort: { faults: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    faults
      .aggregate<{ _id: string; count: number }>([
        { $match: { ...match, failedTime: { $regex: /^\d{2}:/ } } },
        { $group: { _id: hourExpr, count: { $sum: 1 } } },
      ])
      .toArray(),
    faults
      .aggregate<{ _id: number | null; count: number }>([
        { $match: match },
        { $group: { _id: weekdayExpr, count: { $sum: 1 } } },
      ])
      .toArray(),
    stackedByDepartment(db, match, blankTo("$defectType"), 12),
    stackedByDepartment(db, match, blankTo("$workCenter"), 12),
  ]);

  // Heatmap: the 12 busiest machine areas against the 10 most common defect types.
  const areaTotals = new Map<string, number>();
  const defectTotals = new Map<string, number>();
  for (const cell of cells) {
    areaTotals.set(cell._id.area, (areaTotals.get(cell._id.area) ?? 0) + cell.count);
    defectTotals.set(cell._id.defect, (defectTotals.get(cell._id.defect) ?? 0) + cell.count);
  }
  const top = (totals: Map<string, number>, size: number) =>
    [...totals.entries()]
      .filter(([name]) => name !== BLANK)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, size)
      .map(([name]) => name);
  const areas = top(areaTotals, 12);
  const defects = top(defectTotals, 10);
  const wantedAreas = new Set(areas);
  const wantedDefects = new Set(defects);
  const heatCells = cells
    .filter((cell) => wantedAreas.has(cell._id.area) && wantedDefects.has(cell._id.defect))
    .map((cell) => ({ area: cell._id.area, defect: cell._id.defect, count: cell.count }));

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, "0");
    return { hour: key, count: hourRows.find((row) => row._id === key)?.count ?? 0 };
  });
  const weekdays = WEEKDAYS.map((name, index) => ({
    weekday: name,
    index,
    count: weekdayRows.find((row) => row._id === index)?.count ?? 0,
  }));

  return {
    totals: { faults: totalRow[0]?.faults ?? 0, uniqueBuilds: (totalRow[0]?.builds ?? []).filter(Boolean).length },
    heatmap: { areas, defects, cells: heatCells },
    models: models.map((row) => ({
      model: row._id,
      faults: row.faults,
      builds: row.builds,
      faultsPerBuild: row.builds ? row.faults / row.builds : null,
      lowVolume: row.builds < 5,
    })),
    hours,
    weekdays,
    defectMix,
    workCentres,
    departments: [...PANELS, OFF_PANEL],
  };
}

type Movement = "New" | "Rising" | "Falling" | "Steady";

function classify(recent: number, prior: number): Movement {
  if (prior === 0 && recent > 0) return "New";
  const diff = recent - prior;
  if (diff >= 3 && recent >= prior * 1.25) return "Rising";
  if (diff <= -3 && recent <= prior * 0.75) return "Falling";
  return "Steady";
}

export async function getFaultAnalytics(db: Db, filters: AnalyticsFilters, anchor: string | null) {
  const faults = db.collection("faults");
  const match = baseMatch(filters);

  const [grouped, rules] = await Promise.all([
    faults
      .aggregate<{ _id: string; count: number; comments: string[] }>(
        [
          { $match: { ...match, cleansedFault: { $nin: ["", null] } } },
          { $group: { _id: "$cleansedFault", count: { $sum: 1 }, comments: { $addToSet: { $toLower: "$comments" } } } },
          { $sort: { count: -1, _id: 1 } },
        ],
        { allowDiskUse: true },
      )
      .toArray(),
    loadRules(db),
  ]);

  const totalFaults = grouped.reduce((sum, row) => sum + row.count, 0);

  // Pareto: the top 20 cleansed faults and how much of the volume they cover.
  let running = 0;
  const pareto = grouped.slice(0, 20).map((row) => {
    running += row.count;
    return {
      fault: row._id,
      count: row.count,
      cumulativeShare: totalFaults ? (running / totalFaults) * 100 : 0,
    };
  });
  let reach = 0;
  let faultsFor80 = 0;
  for (const row of grouped) {
    reach += row.count;
    faultsFor80 += 1;
    if (totalFaults && reach / totalFaults >= 0.8) break;
  }

  // Cleansing coverage: faults named by a rule against faults left with a tidied comment.
  const ruleNames = new Set(rules.filter((rule) => rule.enabled).map((rule) => rule.category));
  let ruleFaults = 0;
  for (const row of grouped) if (ruleNames.has(row._id)) ruleFaults += row.count;
  const coverage = {
    totalFaults,
    ruleFaults,
    fallbackFaults: totalFaults - ruleFaults,
    distinctFaults: grouped.length,
    topRules: grouped
      .filter((row) => ruleNames.has(row._id))
      .slice(0, 10)
      .map((row) => ({ fault: row._id, count: row.count })),
    variants: [...grouped]
      .map((row) => ({ fault: row._id, faults: row.count, rawComments: row.comments.length }))
      .filter((row) => row.faults >= 5)
      .sort((a, b) => b.rawComments - a.rawComments || b.faults - a.faults)
      .slice(0, 10),
  };

  const [failedToRows, movement] = await Promise.all([
    faults
      .aggregate<{ _id: { failedTo: string; dept: string }; count: number }>([
        { $match: match },
        { $group: { _id: { failedTo: blankTo("$failedTo"), dept: deptExpr }, count: { $sum: 1 } } },
      ])
      .toArray(),
    getMovement(db, filters, anchor),
  ]);

  const failedToMap = new Map<string, { failedTo: string; total: number; departments: Record<string, number> }>();
  for (const row of failedToRows) {
    const entry = failedToMap.get(row._id.failedTo) ?? { failedTo: row._id.failedTo, total: 0, departments: {} };
    entry.total += row.count;
    const dept = row._id.dept ?? OFF_PANEL;
    entry.departments[dept] = (entry.departments[dept] ?? 0) + row.count;
    failedToMap.set(row._id.failedTo, entry);
  }
  const failedTo = [...failedToMap.values()].sort((a, b) => b.total - a.total || a.failedTo.localeCompare(b.failedTo));

  return {
    totalFaults,
    pareto,
    faultsFor80,
    distinctFaults: grouped.length,
    coverage,
    failedTo: failedTo.slice(0, 25),
    failedToCount: failedTo.length,
    movement,
    departments: [...PANELS, OFF_PANEL],
  };
}

// The 4 weeks up to the anchor date against the 4 weeks before them.
// The From filter is ignored here so the comparison always has both windows.
async function getMovement(db: Db, filters: AnalyticsFilters, anchor: string | null) {
  const end = filters.to || anchor;
  // Panels only hold mapped faults, so there is nothing to compare for the Off panel filter.
  if (!end || filters.department === OFF_PANEL) return { recentFrom: null, recentTo: null, priorFrom: null, priorTo: null, departments: [] };
  const recentFrom = addDays(end, -27);
  const priorTo = addDays(end, -28);
  const priorFrom = addDays(end, -55);
  const match = { ...baseMatch({ ...filters, from: undefined, to: undefined }), failedDate: { $gte: priorFrom, $lte: end } };

  const rows = await db
    .collection("faults")
    .aggregate<{ _id: { dept: string; fault: string }; recent: number; prior: number }>([
      { $match: { ...match, showOnPanel: true, cleansedFault: { $nin: ["", null] } } },
      {
        $group: {
          _id: { dept: "$executiveDepartment", fault: "$cleansedFault" },
          recent: { $sum: { $cond: [{ $gte: ["$failedDate", recentFrom] }, 1, 0] } },
          prior: { $sum: { $cond: [{ $lte: ["$failedDate", priorTo] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const departments = PANELS.map((department) => ({
    department,
    rows: rows
      .filter((row) => row._id.dept === department && row.recent + row.prior >= 5)
      .map((row) => ({
        fault: row._id.fault,
        recent: row.recent,
        prior: row.prior,
        change: row.recent - row.prior,
        status: classify(row.recent, row.prior),
      }))
      .sort((a, b) => b.recent - a.recent || b.prior - a.prior || a.fault.localeCompare(b.fault))
      .slice(0, 8),
  }));
  return { recentFrom, recentTo: end, priorFrom, priorTo, departments };
}

export const EXPLORE_MEASURES = ["faults", "builds", "faultsPerBuild"] as const;
export type ExploreMeasure = (typeof EXPLORE_MEASURES)[number];

// Only these breakdowns can be asked for. failed_by is deliberately not one of them.
const EXPLORE_FIELDS: Record<string, { expr: unknown; time?: boolean }> = {
  department: { expr: deptExpr },
  model: { expr: blankTo("$model") },
  machineArea: { expr: blankTo("$machineArea") },
  defectType: { expr: blankTo("$defectType") },
  workCenter: { expr: blankTo("$workCenter") },
  failedTo: { expr: blankTo("$failedTo") },
  hour: { expr: hourExpr, time: true },
  weekday: { expr: weekdayExpr, time: true },
  week: { expr: "$weekCommencing", time: true },
  month: { expr: "$month", time: true },
};
export const EXPLORE_BREAKDOWNS = Object.keys(EXPLORE_FIELDS);

export async function getExplore(
  db: Db,
  filters: AnalyticsFilters,
  measure: ExploreMeasure,
  by: string,
  limit: number,
) {
  const field = EXPLORE_FIELDS[by];
  if (!field) throw new Error("Unknown breakdown.");
  const rows = await db
    .collection("faults")
    .aggregate<{ _id: string | number | null; faults: number; builds: number }>([
      { $match: baseMatch(filters) },
      { $group: { _id: field.expr, faults: { $sum: 1 }, builds: { $addToSet: "$buildNumber" } } },
      { $project: { faults: 1, builds: { $size: "$builds" } } },
    ])
    .toArray();

  // Weekly series leave out the production shutdown weeks, which would drag the line to zero.
  const shutdowns = by === "week" ? await shutdownMap(db) : new Map<string, string>();

  const mapped = rows
    .filter((row) => row._id !== null && row._id !== undefined && row._id !== "")
    .filter((row) => !shutdowns.has(String(row._id)))
    .map((row) => {
      const label = by === "weekday" ? WEEKDAYS[Number(row._id)] : String(row._id);
      const faultsPerBuild = row.builds ? row.faults / row.builds : 0;
      const value = measure === "faults" ? row.faults : measure === "builds" ? row.builds : faultsPerBuild;
      return {
        key: label,
        label,
        faults: row.faults,
        builds: row.builds,
        faultsPerBuild,
        value,
        // Faults per build over fewer than 5 builds is too noisy to rank.
        lowVolume: measure === "faultsPerBuild" && row.builds < 5,
        order: by === "weekday" ? Number(row._id) : 0,
      };
    });

  if (field.time) {
    mapped.sort((a, b) => (by === "weekday" ? a.order - b.order : a.label.localeCompare(b.label)));
    // Hours and weekdays always show in full. Weeks and months keep the latest ones.
    const keepAll = by === "hour" || by === "weekday";
    return { measure, by, time: true, rows: keepAll ? mapped : mapped.slice(-limit) };
  }
  mapped.sort((a, b) => Number(a.lowVolume) - Number(b.lowVolume) || b.value - a.value || a.label.localeCompare(b.label));
  return { measure, by, time: false, rows: mapped.slice(0, limit) };
}

// Match used by the records sheet. It follows the shared filters plus one chart mark.
export function recordsMatch(filters: RecordFilters): Match {
  const match = baseMatch(filters);
  if (filters.machineArea) Object.assign(match, equalsLabel("machineArea", filters.machineArea));
  if (filters.defectType) Object.assign(match, equalsLabel("defectType", filters.defectType));
  if (filters.failedTo) Object.assign(match, equalsLabel("failedTo", filters.failedTo));
  if (filters.cleansedFault) match.cleansedFault = filters.cleansedFault;
  if (filters.week) match.weekCommencing = filters.week;
  if (filters.month) match.month = filters.month;
  if (filters.hour) match.failedTime = { $regex: new RegExp(`^${filters.hour}:`) };
  if (filters.weekday) {
    const index = WEEKDAYS.indexOf(filters.weekday as (typeof WEEKDAYS)[number]);
    if (index >= 0) match.$expr = { $eq: [weekdayExpr, index] };
  }
  return match;
}
