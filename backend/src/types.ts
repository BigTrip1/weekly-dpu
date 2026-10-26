export const PANELS = [
  "Shot & Paint",
  "Manufacturing Facilities",
  "Parts / POF",
  "Production",
  "Cab Systems",
  "Supplier Quality",
] as const;

export type Panel = (typeof PANELS)[number];

export type MappingStatus = "panel" | "hidden" | "unmapped";

export type Rule = {
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

export type StoredRule = Rule & { _id: string };

export type DeptMapping = {
  failedToKey: string;
  failedToLabel: string;
  department: string | null;
  hidden: boolean;
  defectTypeContains: string;
};

export type SourceFields = {
  orderNumber: string;
  buildNumber: string;
  serialNumber: string;
  model: string;
  workCenter: string;
  checkText: string;
  comments: string;
  failedTo: string;
  machineArea: string;
  defectType: string;
  failedBy: string;
  failedDate: string;
  failedTime: string;
  fixedBy: string;
  fixedDate: string;
  fixedTime: string;
  fix: string;
};

export type ParsedRow = SourceFields & {
  sourceRow: number;
  failedDateRaw: string;
  exclusionReason: string | null;
  rowHash: string;
  eventKey: string;
};

export function isPanel(value: string | null | undefined): value is Panel {
  return !!value && (PANELS as readonly string[]).includes(value);
}

export function emptyRule(partial: Partial<Rule> = {}): Rule {
  return {
    priority: partial.priority ?? 100,
    category: partial.category ?? "",
    enabled: partial.enabled ?? true,
    commentAll: partial.commentAll ?? [],
    commentAny: partial.commentAny ?? [],
    commentAny2: partial.commentAny2 ?? [],
    machineAreaContains: partial.machineAreaContains ?? "",
    defectTypeContains: partial.defectTypeContains ?? "",
    checkTextContains: partial.checkTextContains ?? "",
    workCenters: partial.workCenters ?? [],
    excludeCommentContains: partial.excludeCommentContains ?? [],
    notes: partial.notes ?? "",
  };
}
