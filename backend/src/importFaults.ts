import type { Db, ObjectId } from "mongodb";
import { deriveReporting, loadMappings, loadRules, ruleVersion } from "./reporting.js";
import type { ParsedRow } from "./types.js";

type ExistingFault = {
  _id: ObjectId;
  rowHash: string;
  eventKey: string;
  model: string;
  failedBy: string;
  sourceRow: number;
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

export async function importRows(db: Db, filename: string, rows: ParsedRow[]): Promise<ImportSummary> {
  const now = new Date();
  const batchInsert = await db.collection("import_batches").insertOne({
    filename,
    uploadedAt: now,
    status: "running",
    inserted: 0,
    exactDuplicatesSkipped: 0,
    closureRefreshed: 0,
    excluded: 0,
    operationalReviews: 0,
  });
  const batchId = batchInsert.insertedId;

  try {
    const summary = await runImport(db, batchId, filename, rows, now);
    await db.collection("import_batches").updateOne({ _id: batchId }, { $set: { ...summary, status: "completed" } });
    return { batchId: String(batchId), filename, ...summary };
  } catch (error) {
    await db.collection("faults").deleteMany({ importBatchId: batchId });
    await db.collection("excluded_records").deleteMany({ importBatchId: batchId });
    await db.collection("duplicate_audits").deleteMany({ importBatchId: batchId });
    await db.collection("operational_reviews").deleteMany({ importBatchId: batchId });
    await db.collection("import_batches").updateOne(
      { _id: batchId },
      { $set: { status: "failed", error: error instanceof Error ? error.message : "Import failed" } },
    );
    throw error;
  }
}

async function runImport(db: Db, batchId: ObjectId, filename: string, rows: ParsedRow[], now: Date) {
  const [rules, mappings, version, existingDocs, existingExcluded] = await Promise.all([
    loadRules(db),
    loadMappings(db),
    ruleVersion(db),
    db
      .collection("faults")
      .find({}, { projection: { rowHash: 1, eventKey: 1, model: 1, failedBy: 1, sourceRow: 1 } })
      .toArray(),
    db.collection("excluded_records").find({}, { projection: { rowHash: 1 } }).toArray(),
  ]);

  const byHash = new Map<string, ExistingFault>();
  const byEvent = new Map<string, ExistingFault[]>();
  for (const doc of existingDocs) {
    const existing: ExistingFault = {
      _id: doc._id,
      rowHash: String(doc.rowHash),
      eventKey: String(doc.eventKey),
      model: String(doc.model ?? ""),
      failedBy: String(doc.failedBy ?? ""),
      sourceRow: Number(doc.sourceRow ?? 0),
    };
    byHash.set(existing.rowHash, existing);
    const list = byEvent.get(existing.eventKey) ?? [];
    list.push(existing);
    byEvent.set(existing.eventKey, list);
  }
  const excludedHashes = new Set(existingExcluded.map((doc) => String(doc.rowHash)));

  const reportable: ParsedRow[] = [];
  const excludedDocs = [];
  let excluded = 0;
  for (const row of rows) {
    if (row.exclusionReason) {
      excluded += 1;
      if (!excludedHashes.has(row.rowHash)) {
        excludedHashes.add(row.rowHash);
        excludedDocs.push(excludedDocument(row, batchId, filename, now));
      }
    } else {
      reportable.push(row);
    }
  }

  const seenHash = new Map<string, ParsedRow>();
  const uniqueRows: ParsedRow[] = [];
  const duplicateDocs = [];
  for (const row of reportable) {
    const previous = seenHash.get(row.rowHash);
    if (previous) {
      duplicateDocs.push(duplicateDocument(row, previous.sourceRow, null, batchId, filename, now, "Exact duplicate A-Q"));
    } else {
      seenHash.set(row.rowHash, row);
      uniqueRows.push(row);
    }
  }

  const eventCounts = new Map<string, number>();
  for (const row of uniqueRows) eventCounts.set(row.eventKey, (eventCounts.get(row.eventKey) ?? 0) + 1);
  const withinFileMulti = new Set([...eventCounts].filter(([, count]) => count > 1).map(([key]) => key));

  const toInsert = [];
  const closureOps = [];
  const reviewKeys = new Set<string>();
  let exactDuplicatesSkipped = duplicateDocs.length;
  let closureRefreshed = 0;

  for (const row of uniqueRows) {
    const hashed = byHash.get(row.rowHash);
    if (hashed) {
      exactDuplicatesSkipped += 1;
      duplicateDocs.push(
        duplicateDocument(row, hashed.sourceRow, hashed._id, batchId, filename, now, "Exact duplicate A-Q"),
      );
      continue;
    }

    const group = byEvent.get(row.eventKey) ?? [];
    const sole = group.length === 1 ? group[0] : undefined;
    const closureOnly =
      sole &&
      !withinFileMulti.has(row.eventKey) &&
      sole.model === row.model &&
      sole.failedBy === row.failedBy;

    if (closureOnly && sole) {
      closureRefreshed += 1;
      byHash.delete(sole.rowHash);
      sole.rowHash = row.rowHash;
      byHash.set(row.rowHash, sole);
      closureOps.push({
        updateOne: {
          filter: { _id: sole._id },
          update: {
            $set: {
              fixedBy: row.fixedBy,
              fixedDate: row.fixedDate,
              fixedTime: row.fixedTime,
              fix: row.fix,
              rowHash: row.rowHash,
              closureStatus: row.fixedDate && row.fixedDate !== "2020-01-01" ? "Fixed" : "Open",
              closureUpdatedAt: now,
              updatedByBatchId: batchId,
              updatedAt: now,
            },
          },
        },
      });
      continue;
    }

    const derived = deriveReporting(row, rules, mappings, version);
    toInsert.push({
      ...faultDocument(row, derived, batchId, now),
    });
    const stub: ExistingFault = {
      _id: batchId,
      rowHash: row.rowHash,
      eventKey: row.eventKey,
      model: row.model,
      failedBy: row.failedBy,
      sourceRow: row.sourceRow,
    };
    byHash.set(row.rowHash, stub);
    group.push(stub);
    byEvent.set(row.eventKey, group);
    if (group.length > 1 || withinFileMulti.has(row.eventKey)) reviewKeys.add(row.eventKey);
  }

  if (excludedDocs.length) await db.collection("excluded_records").insertMany(excludedDocs, { ordered: false });
  if (toInsert.length) await db.collection("faults").insertMany(toInsert, { ordered: false });
  if (closureOps.length) await db.collection("faults").bulkWrite(closureOps, { ordered: false });

  const reviewDocs = [];
  if (reviewKeys.size) {
    const related = await db
      .collection("faults")
      .find({ eventKey: { $in: [...reviewKeys] } })
      .project({
        eventKey: 1,
        sourceRow: 1,
        buildNumber: 1,
        comments: 1,
        model: 1,
        failedDate: 1,
        failedTime: 1,
        fixedDate: 1,
        fixedBy: 1,
        failedBy: 1,
        fix: 1,
        workCenter: 1,
        failedTo: 1,
      })
      .toArray();
    const grouped = new Map<string, typeof related>();
    for (const fault of related) {
      const key = String(fault.eventKey);
      const list = grouped.get(key) ?? [];
      list.push(fault);
      grouped.set(key, list);
    }
    for (const [eventKey, faults] of grouped) {
      if (faults.length < 2) continue;
      reviewDocs.push({
        importBatchId: batchId,
        filename,
        eventKey,
        reason: "Same machine, checkpoint, comment, allocation and timestamp, but other source fields differ",
        recordCount: faults.length,
        records: faults.map((fault) => ({
          faultId: String(fault._id),
          sourceRow: fault.sourceRow ?? null,
          buildNumber: fault.buildNumber ?? "",
          model: fault.model ?? "",
          workCenter: fault.workCenter ?? "",
          failedTo: fault.failedTo ?? "",
          failedDate: fault.failedDate ?? "",
          failedTime: fault.failedTime ?? "",
          comments: fault.comments ?? "",
          fixedDate: fault.fixedDate ?? "",
          fix: fault.fix ?? "",
          failedBy: fault.failedBy ?? "",
          fixedBy: fault.fixedBy ?? "",
        })),
        createdAt: now,
      });
    }
  }

  if (duplicateDocs.length) await db.collection("duplicate_audits").insertMany(duplicateDocs, { ordered: false });
  if (reviewDocs.length) await db.collection("operational_reviews").insertMany(reviewDocs, { ordered: false });

  return {
    inserted: toInsert.length,
    exactDuplicatesSkipped,
    closureRefreshed,
    excluded,
    operationalReviews: reviewDocs.length,
    ruleVersion: version,
  };
}

function faultDocument(
  row: ParsedRow,
  derived: ReturnType<typeof deriveReporting>,
  batchId: ObjectId,
  now: Date,
) {
  return {
    sourceRow: row.sourceRow,
    orderNumber: row.orderNumber,
    buildNumber: row.buildNumber,
    serialNumber: row.serialNumber,
    model: row.model,
    workCenter: row.workCenter,
    checkText: row.checkText,
    comments: row.comments,
    failedTo: row.failedTo,
    machineArea: row.machineArea,
    defectType: row.defectType,
    failedBy: row.failedBy,
    failedDate: row.failedDate,
    failedTime: row.failedTime,
    fixedBy: row.fixedBy,
    fixedDate: row.fixedDate,
    fixedTime: row.fixedTime,
    fix: row.fix,
    rowHash: row.rowHash,
    eventKey: row.eventKey,
    importBatchId: batchId,
    ...derived,
    createdAt: now,
    updatedAt: now,
  };
}

function excludedDocument(row: ParsedRow, batchId: ObjectId, filename: string, now: Date) {
  return {
    importBatchId: batchId,
    filename,
    sourceRow: row.sourceRow,
    reason: row.exclusionReason,
    rowHash: row.rowHash,
    buildNumber: row.buildNumber,
    orderNumber: row.orderNumber,
    serialNumber: row.serialNumber,
    model: row.model,
    failedTo: row.failedTo,
    comments: row.comments,
    machineArea: row.machineArea,
    defectType: row.defectType,
    checkText: row.checkText,
    workCenter: row.workCenter,
    failedDateRaw: row.failedDateRaw,
    createdAt: now,
  };
}

function duplicateDocument(
  row: ParsedRow,
  retainedSourceRow: number,
  retainedFaultId: ObjectId | null,
  batchId: ObjectId,
  filename: string,
  now: Date,
  reason: string,
) {
  return {
    importBatchId: batchId,
    filename,
    reason,
    removedSourceRow: row.sourceRow,
    retainedSourceRow,
    retainedFaultId,
    rowHash: row.rowHash,
    buildNumber: row.buildNumber,
    comments: row.comments,
    failedDate: row.failedDate,
    failedTo: row.failedTo,
    createdAt: now,
  };
}
