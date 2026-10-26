import type { Db, ObjectId } from "mongodb";
import { cleanseFault, describeMapping, matchMapping } from "./cleanse.js";
import { closureStatus, weekCommencing } from "./dates.js";
import type { DeptMapping, Rule, SourceFields } from "./types.js";

export type Derived = {
  cleansedFault: string;
  executiveDepartment: string | null;
  showOnPanel: boolean;
  mappingStatus: "panel" | "hidden" | "unmapped";
  month: string;
  weekCommencing: string;
  closureStatus: "Open" | "Fixed";
  ruleVersion: number;
};

export async function loadRules(db: Db): Promise<Rule[]> {
  const docs = await db.collection("cleansing_rules").find({}).toArray();
  return docs.map((doc) => ({
    priority: Number(doc.priority) || 0,
    category: String(doc.category ?? ""),
    enabled: doc.enabled !== false,
    commentAll: asStringArray(doc.commentAll),
    commentAny: asStringArray(doc.commentAny),
    commentAny2: asStringArray(doc.commentAny2),
    machineAreaContains: String(doc.machineAreaContains ?? ""),
    defectTypeContains: String(doc.defectTypeContains ?? ""),
    checkTextContains: String(doc.checkTextContains ?? ""),
    workCenters: asStringArray(doc.workCenters),
    excludeCommentContains: asStringArray(doc.excludeCommentContains),
    notes: String(doc.notes ?? ""),
  }));
}

export async function loadMappings(db: Db): Promise<DeptMapping[]> {
  const docs = await db.collection("department_mappings").find({}).toArray();
  return docs.map((doc) => ({
    failedToKey: String(doc.failedToKey ?? ""),
    failedToLabel: String(doc.failedToLabel ?? ""),
    department: doc.department ? String(doc.department) : null,
    hidden: Boolean(doc.hidden),
    defectTypeContains: String(doc.defectTypeContains ?? ""),
  }));
}

export async function ruleVersion(db: Db): Promise<number> {
  const settings = await db.collection("settings").findOne({ _id: "app" as unknown as ObjectId });
  return Number(settings?.ruleVersion ?? 1);
}

export function deriveReporting(row: SourceFields, rules: Rule[], mappings: DeptMapping[], version: number): Derived {
  const cleansedFault = cleanseFault(row, rules);
  const mapping = describeMapping(matchMapping(row.failedTo, row.defectType, mappings));
  return {
    cleansedFault,
    executiveDepartment: mapping.executiveDepartment,
    showOnPanel: mapping.showOnPanel,
    mappingStatus: mapping.mappingStatus,
    month: row.failedDate.slice(0, 7),
    weekCommencing: weekCommencing(row.failedDate),
    closureStatus: closureStatus(row.fixedDate),
    ruleVersion: version,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function rederiveAll(db: Db): Promise<number> {
  const [rules, mappings, version] = await Promise.all([loadRules(db), loadMappings(db), ruleVersion(db)]);
  const cursor = db.collection("faults").find({});
  const ops = [];
  let count = 0;
  for await (const fault of cursor) {
    const derived = deriveReporting(
      {
        orderNumber: String(fault.orderNumber ?? ""),
        buildNumber: String(fault.buildNumber ?? ""),
        serialNumber: String(fault.serialNumber ?? ""),
        model: String(fault.model ?? ""),
        workCenter: String(fault.workCenter ?? ""),
        checkText: String(fault.checkText ?? ""),
        comments: String(fault.comments ?? ""),
        failedTo: String(fault.failedTo ?? ""),
        machineArea: String(fault.machineArea ?? ""),
        defectType: String(fault.defectType ?? ""),
        failedBy: String(fault.failedBy ?? ""),
        failedDate: String(fault.failedDate ?? ""),
        failedTime: String(fault.failedTime ?? ""),
        fixedBy: String(fault.fixedBy ?? ""),
        fixedDate: String(fault.fixedDate ?? ""),
        fixedTime: String(fault.fixedTime ?? ""),
        fix: String(fault.fix ?? ""),
      },
      rules,
      mappings,
      version,
    );
    ops.push({
      updateOne: {
        filter: { _id: fault._id },
        update: { $set: { ...derived, updatedAt: new Date() } },
      },
    });
    if (ops.length >= 1000) {
      await db.collection("faults").bulkWrite(ops, { ordered: false });
      count += ops.length;
      ops.length = 0;
    }
  }
  if (ops.length) {
    await db.collection("faults").bulkWrite(ops, { ordered: false });
    count += ops.length;
  }
  return count;
}

export async function bumpRuleVersion(db: Db): Promise<number> {
  const result = await db.collection("settings").findOneAndUpdate(
    { _id: "app" as unknown as ObjectId },
    { $inc: { ruleVersion: 1 } },
    { returnDocument: "after" },
  );
  return Number(result?.ruleVersion ?? 1);
}
