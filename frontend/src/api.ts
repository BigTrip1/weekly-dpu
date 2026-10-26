export type WeekOption = { week: string; label: string; faults: number; shutdown: string | null };
export type MonthOption = { month: string; label: string; weeks: WeekOption[] };

export type DashboardRow = {
  cleansedFault: string;
  count: number;
  previousCount: number | null;
  trend: number | null;
  share: number;
  previousShare: number | null;
  shareChange: number | null;
};

export type DashboardResponse = {
  month: string;
  week: string;
  monthLabel: string;
  periodLabel: string;
  view: "weekly" | "monthly" | "ytd";
  partial: boolean;
  comparisonLabel: string;
  comparisonAvailable: boolean;
  totals: {
    faults: number;
    uniqueBuilds: number;
    faultsPerBuild: number | null;
    unmapped: number;
    hidden: number;
  };
  previousTotals: { faults: number; uniqueBuilds: number; faultsPerBuild: number | null } | null;
  panels: { department: string; total: number; rows: DashboardRow[] }[];
};

export type TrendWeek = {
  week: string;
  label: string;
  total: number;
  partial: boolean;
  selected: boolean;
  panels: Record<string, number>;
};

export type SkippedWeek = { week: string; label: string; reason: string };

export type TrendResponse = { panels: string[]; year: number; weeks: TrendWeek[]; skipped: SkippedWeek[] };

export type DrillRow = {
  id: string;
  sourceRow: number | null;
  orderNumber: string;
  buildNumber: string;
  serialNumber: string;
  model: string;
  workCenter: string;
  checkText: string;
  comments: string;
  cleansedFault: string;
  failedTo: string;
  executiveDepartment: string;
  machineArea: string;
  defectType: string;
  failedBy: string;
  failedDate: string;
  failedTime: string;
  fixedDate: string;
  fixedTime: string;
  closureStatus: string;
  fix: string;
};

export type ImportSummary = {
  batchId: string;
  filename: string;
  inserted: number;
  exactDuplicatesSkipped: number;
  closureRefreshed: number;
  excluded: number;
  operationalReviews: number;
  ruleVersion: number;
};

export type ImportBatch = ImportSummary & {
  id: string;
  uploadedAt: string | null;
  status: string;
  error: string;
};

export type MappingRow = {
  failedTo: string;
  count: number;
  department: string | null;
  hidden: boolean;
  defectTypeContains: string;
  status: "panel" | "hidden" | "unmapped";
};

export type Rule = {
  id?: string;
  priority: number;
  category: string;
  enabled: boolean;
  commentAll: string[];
  commentAny: string[];
  commentAny2: string[];
  machineAreaContains: string;
  defectTypeContains: string;
  checkTextContains: string;
  workCenters: string[];
  excludeCommentContains: string[];
  notes: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body as T;
}

export type YtdOption = { value: string; year: number; label: string; from: string; to: string };

export type YearOption = { year: number; current: boolean; ytd: YtdOption };

export function getPeriods() {
  return request<{ months: MonthOption[]; years: YearOption[] }>("/api/periods");
}

export type ShutdownWeek = { week: string; reason: string };

export function getShutdownWeeks() {
  return request<{ weeks: ShutdownWeek[] }>("/api/shutdown-weeks");
}

export function addShutdownWeek(date: string, reason: string) {
  return request<ShutdownWeek>("/api/shutdown-weeks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, reason }),
  });
}

export function removeShutdownWeek(week: string) {
  return request<{ ok: boolean }>(`/api/shutdown-weeks/${week}`, { method: "DELETE" });
}

export function getDashboard(month: string, week: string) {
  const params = new URLSearchParams({ month, week });
  return request<DashboardResponse>(`/api/dashboard?${params}`);
}

export function getTrend(month: string, week: string) {
  const params = new URLSearchParams({ month, week });
  return request<TrendResponse>(`/api/dashboard/trend?${params}`);
}

// Leave cleansedFault empty for every fault in the department. Leave month empty to match one week by date alone.
export function getFaults(month: string, week: string, department: string, cleansedFault = "") {
  const params = new URLSearchParams({ week, department });
  if (month) params.set("month", month);
  if (cleansedFault) params.set("cleansedFault", cleansedFault);
  return request<{ total: number; rows: DrillRow[] }>(`/api/faults?${params}`);
}

export function getImports() {
  return request<{ rows: ImportBatch[] }>("/api/imports");
}

export function uploadWorkbook(file: File) {
  const data = new FormData();
  data.append("file", file);
  return request<ImportSummary>("/api/imports", { method: "POST", body: data });
}

export function getMappings() {
  return request<{ panels: string[]; rows: MappingRow[] }>("/api/mappings");
}

export type MappingFault = {
  id: string;
  buildNumber: string;
  model: string;
  serialNumber: string;
  workCenter: string;
  failedDate: string;
  failedTime: string;
  comments: string;
  machineArea: string;
  defectType: string;
  cleansedFault: string;
  executiveDepartment: string;
  mappingStatus: string;
  closureStatus: string;
  fixedDate: string;
};

export function saveMapping(body: { failedTo: string; department: string; defectTypeContains: string }) {
  return request<{ updated: number; ruleVersion: number; appliesToEveryDefect: boolean }>("/api/mappings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getMappingFaults(failedTo: string, page: number) {
  const params = new URLSearchParams({ failedTo, page: String(page), pageSize: "25" });
  return request<{ total: number; page: number; pageSize: number; rows: MappingFault[] }>(`/api/mappings/faults?${params}`);
}

export function getRules() {
  return request<{ rules: Rule[] }>("/api/rules");
}

export function createRule(rule: Rule) {
  return request<{ id: string; updated: number }>("/api/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}

export function updateRule(id: string, rule: Rule) {
  return request<{ updated: number }>(`/api/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}

export function deleteRule(id: string) {
  return request<{ updated: number }>(`/api/rules/${id}`, { method: "DELETE" });
}

export function getAudit(kind: "excluded" | "duplicates" | "operational", page: number) {
  return request<{ total: number; page: number; pageSize: number; rows: Record<string, unknown>[] }>(
    `/api/audits/${kind}?page=${page}&pageSize=50`,
  );
}

// Analytics. Every call takes the shared filters. A chart mark adds one more field when it opens records.
export type AnalyticsFilters = {
  from?: string;
  to?: string;
  department?: string;
  model?: string;
  workCenter?: string;
};

export type RecordQuery = Partial<
  AnalyticsFilters & {
    machineArea: string;
    defectType: string;
    failedTo: string;
    cleansedFault: string;
    hour: string;
    weekday: string;
    week: string;
    month: string;
  }
>;

export type AnalyticsMeta = {
  min: string | null;
  max: string | null;
  total: number;
  models: string[];
  workCenters: string[];
  departments: string[];
};

export type StackRow = { label: string; total: number; departments: Record<string, number> };

export type PatternsResponse = {
  totals: { faults: number; uniqueBuilds: number };
  heatmap: { areas: string[]; defects: string[]; cells: { area: string; defect: string; count: number }[] };
  models: { model: string; faults: number; builds: number; faultsPerBuild: number | null; lowVolume: boolean }[];
  hours: { hour: string; count: number }[];
  weekdays: { weekday: string; index: number; count: number }[];
  defectMix: StackRow[];
  workCentres: StackRow[];
  departments: string[];
};

export type MovementStatus = "New" | "Rising" | "Falling" | "Steady";

export type FaultAnalyticsResponse = {
  totalFaults: number;
  pareto: { fault: string; count: number; cumulativeShare: number }[];
  faultsFor80: number;
  distinctFaults: number;
  coverage: {
    totalFaults: number;
    ruleFaults: number;
    fallbackFaults: number;
    distinctFaults: number;
    topRules: { fault: string; count: number }[];
    variants: { fault: string; faults: number; rawComments: number }[];
  };
  failedTo: { failedTo: string; total: number; departments: Record<string, number> }[];
  failedToCount: number;
  movement: {
    recentFrom: string | null;
    recentTo: string | null;
    priorFrom: string | null;
    priorTo: string | null;
    departments: {
      department: string;
      rows: { fault: string; recent: number; prior: number; change: number; status: MovementStatus }[];
    }[];
  };
  departments: string[];
};

export type ExploreMeasure = "faults" | "builds" | "faultsPerBuild";

export type ExploreResponse = {
  measure: ExploreMeasure;
  by: string;
  time: boolean;
  rows: { key: string; label: string; faults: number; builds: number; faultsPerBuild: number; value: number; lowVolume: boolean }[];
};

function analyticsParams(filters: AnalyticsFilters, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value);
  }
  return params;
}

export function getAnalyticsMeta() {
  return request<AnalyticsMeta>("/api/analytics/meta");
}

export function getPatterns(filters: AnalyticsFilters) {
  return request<PatternsResponse>(`/api/analytics/patterns?${analyticsParams(filters)}`);
}

export function getFaultAnalytics(filters: AnalyticsFilters) {
  return request<FaultAnalyticsResponse>(`/api/analytics/faults?${analyticsParams(filters)}`);
}

export function getExplore(filters: AnalyticsFilters, measure: ExploreMeasure, by: string, limit: number) {
  return request<ExploreResponse>(`/api/analytics/explore?${analyticsParams(filters, { measure, by, limit: String(limit) })}`);
}

export function getAnalyticsRecords(filters: AnalyticsFilters, query: RecordQuery) {
  return request<{ total: number; rows: DrillRow[] }>(`/api/analytics/records?${analyticsParams(filters, query)}`);
}
