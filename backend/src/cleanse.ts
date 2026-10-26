import type { DeptMapping, MappingStatus, Rule, SourceFields } from "./types.js";
import { isPanel } from "./types.js";
import { containsTerm, isGenericCheck, isGenericWord, normalize, readable } from "./text.js";

export function recoverLabel(row: Pick<SourceFields, "machineArea" | "defectType" | "checkText" | "failedTo">): string {
  const area = row.machineArea.trim();
  const defect = row.defectType.trim();
  const check = row.checkText.trim();
  const failedTo = row.failedTo.trim();
  if (area && defect) return `${area} ${defect}`;
  if (area) return area;
  if (defect && failedTo) return `${failedTo} ${defect}`;
  if (defect) return defect;
  if (check && !isGenericCheck(check)) return check;
  if (failedTo) return failedTo;
  return "";
}

function commentHaystack(row: SourceFields): string {
  const comment = normalize(row.comments);
  if (comment) return comment;
  return normalize(recoverLabel(row));
}

function matches(rule: Rule, row: SourceFields, haystack: string): boolean {
  const area = normalize(row.machineArea);
  const defect = normalize(row.defectType);
  const check = normalize(row.checkText);
  const workCenter = row.workCenter.trim().toLowerCase();

  if (rule.excludeCommentContains.some((term) => containsTerm(haystack, term))) return false;
  if (rule.machineAreaContains && !area.includes(normalize(rule.machineAreaContains))) return false;
  if (rule.defectTypeContains && !defect.includes(normalize(rule.defectTypeContains))) return false;
  if (rule.checkTextContains && !check.includes(normalize(rule.checkTextContains))) return false;
  if (rule.workCenters.length && !rule.workCenters.some((center) => center.toLowerCase() === workCenter)) {
    return false;
  }
  if (rule.commentAll.length && !rule.commentAll.every((term) => containsTerm(haystack, term))) return false;
  if (rule.commentAny.length && !rule.commentAny.some((term) => containsTerm(haystack, term))) return false;
  if (rule.commentAny2.length && !rule.commentAny2.some((term) => containsTerm(haystack, term))) return false;

  return Boolean(
    rule.commentAll.length ||
      rule.commentAny.length ||
      rule.commentAny2.length ||
      rule.checkTextContains ||
      rule.defectTypeContains,
  );
}

export function cleanseFault(row: SourceFields, rules: Rule[]): string {
  const commentNorm = normalize(row.comments);
  const recoveredNorm = normalize(recoverLabel(row));
  const haystack = commentNorm || recoveredNorm;
  const ordered = rules
    .filter((rule) => rule.enabled)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.category.localeCompare(b.category));

  for (const rule of ordered) {
    if (matches(rule, row, haystack)) return rule.category;
  }

  const fallback = isGenericWord(commentNorm) && recoveredNorm ? recoveredNorm : haystack;
  return readable(fallback);
}

export function matchMapping(failedTo: string, defectType: string, mappings: DeptMapping[]): DeptMapping | null {
  const key = failedTo.trim().toLowerCase();
  const candidates = mappings.filter((mapping) => mapping.failedToKey === key);
  const defect = normalize(defectType);
  const conditional = candidates.find(
    (mapping) => mapping.defectTypeContains && defect.includes(normalize(mapping.defectTypeContains)),
  );
  if (conditional) return conditional;
  return candidates.find((mapping) => !mapping.defectTypeContains) ?? null;
}

export function describeMapping(mapping: DeptMapping | null): {
  executiveDepartment: string | null;
  showOnPanel: boolean;
  mappingStatus: MappingStatus;
} {
  if (!mapping) {
    return { executiveDepartment: null, showOnPanel: false, mappingStatus: "unmapped" };
  }
  if (mapping.hidden || !mapping.department) {
    return { executiveDepartment: null, showOnPanel: false, mappingStatus: "hidden" };
  }
  if (isPanel(mapping.department)) {
    return { executiveDepartment: mapping.department, showOnPanel: true, mappingStatus: "panel" };
  }
  return { executiveDepartment: null, showOnPanel: false, mappingStatus: "unmapped" };
}
