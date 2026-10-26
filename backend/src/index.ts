import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs/promises";
import { MongoServerError, ObjectId, type Document } from "mongodb";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import { getDb } from "./db.js";
import { getDashboard, getDrilldown, getPeriods, getTrend } from "./dashboard.js";
import { importRows } from "./importFaults.js";
import { parseWorkbook } from "./parseWorkbook.js";
import { bumpRuleVersion, rederiveAll } from "./reporting.js";
import { extendedMappings, seedMappings, seedRules } from "./seedData.js";
import { splitList } from "./text.js";
import { PANELS, emptyRule, isPanel, type Rule } from "./types.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const stamp = new Date().toISOString();
    console.log(`${stamp} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

app.get("/api/health", wrap(async (_req, res) => {
  const db = await getDb();
  await db.command({ ping: 1 });
  const faults = await db.collection("faults").countDocuments();
  res.json({ ok: true, faults });
}));

app.get("/api/periods", wrap(async (_req, res) => {
  res.json(await getPeriods(await getDb()));
}));

app.get("/api/dashboard", wrap(async (req, res) => {
  const month = String(req.query.month ?? "");
  const week = String(req.query.week ?? "all");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Choose a month in YYYY-MM format.");
  if (week !== "all" && !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new HttpError(400, "Choose a week commencing date or all.");
  res.json(await getDashboard(await getDb(), month, week));
}));

app.get("/api/dashboard/trend", wrap(async (req, res) => {
  const month = String(req.query.month ?? "");
  const week = String(req.query.week ?? "all");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Choose a month in YYYY-MM format.");
  if (week !== "all" && !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new HttpError(400, "Choose a week commencing date or all.");
  res.json(await getTrend(await getDb(), month, week));
}));

app.get("/api/faults", wrap(async (req, res) => {
  const month = String(req.query.month ?? "");
  const week = String(req.query.week ?? "all");
  const department = String(req.query.department ?? "");
  const cleansedFault = String(req.query.cleansedFault ?? "");
  const weekIsDate = /^\d{4}-\d{2}-\d{2}$/.test(week);
  // A month is optional when a single week is asked for. The weekly trend chart counts by week alone.
  if (month ? !/^\d{4}-\d{2}$/.test(month) : !weekIsDate) throw new HttpError(400, "A month is required.");
  if (week !== "all" && !weekIsDate) throw new HttpError(400, "A week is required.");
  if (!isPanel(department)) throw new HttpError(400, "Choose an executive department.");
  res.json(await getDrilldown(await getDb(), month, week, department, cleansedFault));
}));

app.get("/api/imports", wrap(async (_req, res) => {
  const db = await getDb();
  const rows = await db.collection("import_batches").find({}).sort({ uploadedAt: -1 }).limit(50).toArray();
  res.json({
    rows: rows.map((row) => ({
      id: String(row._id),
      filename: row.filename ?? "",
      uploadedAt: row.uploadedAt ?? null,
      status: row.status ?? "",
      inserted: row.inserted ?? 0,
      exactDuplicatesSkipped: row.exactDuplicatesSkipped ?? 0,
      closureRefreshed: row.closureRefreshed ?? 0,
      excluded: row.excluded ?? 0,
      operationalReviews: row.operationalReviews ?? 0,
      ruleVersion: row.ruleVersion ?? null,
      error: row.error ?? "",
    })),
  });
}));

app.post("/api/imports", upload.single("file"), wrap(async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, "Choose an .xlsx faults extract.");
  if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
    await fs.unlink(file.path).catch(() => undefined);
    throw new HttpError(400, "Upload the faults extract as an .xlsx workbook.");
  }
  try {
    const rows = await parseWorkbook(file.path);
    const summary = await importRows(await getDb(), file.originalname, rows);
    console.log(
      `Upload ${summary.filename}: inserted ${summary.inserted}, exact duplicates skipped ${summary.exactDuplicatesSkipped}, closure refreshed ${summary.closureRefreshed}, excluded ${summary.excluded}, operational reviews ${summary.operationalReviews}`,
    );
    res.status(201).json(summary);
  } finally {
    await fs.unlink(file.path).catch(() => undefined);
  }
}));

app.get("/api/mappings", wrap(async (_req, res) => {
  const db = await getDb();
  const [mappings, counted] = await Promise.all([
    db.collection("department_mappings").find({}).toArray(),
    db.collection("faults").aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$failedTo", count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const rows = new Map<string, {
    failedTo: string;
    count: number;
    department: string | null;
    hidden: boolean;
    defectTypeContains: string;
    status: "panel" | "hidden" | "unmapped";
  }>();

  for (const mapping of mappings) {
    const key = String(mapping.failedToKey ?? "");
    const hidden = Boolean(mapping.hidden) || !mapping.department;
    const department = mapping.department ? String(mapping.department) : null;
    rows.set(key, {
      failedTo: String(mapping.failedToLabel || key),
      count: 0,
      department: hidden ? null : department,
      hidden,
      defectTypeContains: String(mapping.defectTypeContains ?? ""),
      status: hidden ? "hidden" : isPanel(department) ? "panel" : "unmapped",
    });
  }

  for (const item of counted) {
    const label = String(item._id ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = rows.get(key);
    if (existing) {
      existing.count += item.count;
      if (!mappings.some((mapping) => String(mapping.failedToKey) === key)) existing.failedTo = label;
    } else {
      rows.set(key, {
        failedTo: label,
        count: item.count,
        department: null,
        hidden: false,
        defectTypeContains: "",
        status: "unmapped",
      });
    }
  }

  res.json({
    panels: PANELS,
    rows: [...rows.values()].sort((a, b) => b.count - a.count || a.failedTo.localeCompare(b.failedTo)),
  });
}));

app.get("/api/mappings/faults", wrap(async (req, res) => {
  const failedTo = String(req.query.failedTo ?? "").trim();
  if (!failedTo) throw new HttpError(400, "A Failed To value is required.");
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const db = await getDb();
  const filter = { failedTo: { $regex: `^${escapeRegex(failedTo)}$`, $options: "i" } };
  const collection = db.collection("faults");
  const total = await collection.countDocuments(filter);
  const docs = await collection
    .find(filter)
    .project({
      buildNumber: 1,
      model: 1,
      serialNumber: 1,
      workCenter: 1,
      failedDate: 1,
      failedTime: 1,
      comments: 1,
      machineArea: 1,
      defectType: 1,
      cleansedFault: 1,
      executiveDepartment: 1,
      mappingStatus: 1,
      closureStatus: 1,
      fixedDate: 1,
    })
    .sort({ failedDate: -1, buildNumber: 1, sourceRow: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  res.json({
    failedTo,
    total,
    page,
    pageSize,
    rows: docs.map((doc) => ({
      id: String(doc._id),
      buildNumber: doc.buildNumber ?? "",
      model: doc.model ?? "",
      serialNumber: doc.serialNumber ?? "",
      workCenter: doc.workCenter ?? "",
      failedDate: doc.failedDate ?? "",
      failedTime: doc.failedTime ?? "",
      comments: doc.comments ?? "",
      machineArea: doc.machineArea ?? "",
      defectType: doc.defectType ?? "",
      cleansedFault: doc.cleansedFault ?? "",
      executiveDepartment: doc.executiveDepartment ?? "",
      mappingStatus: doc.mappingStatus ?? "unmapped",
      closureStatus: doc.closureStatus ?? "",
      fixedDate: doc.fixedDate ?? "",
    })),
  });
}));

app.put("/api/mappings", wrap(async (req, res) => {
  const failedTo = String(req.body?.failedTo ?? "").trim();
  const selected = String(req.body?.department ?? "").trim();
  const defectTypeContains = String(req.body?.defectTypeContains ?? "").trim();
  const appliesToEveryDefect = defectTypeContains.length === 0;
  if (!failedTo) throw new HttpError(400, "A Failed To value is required.");
  if (selected && selected !== "Hidden" && selected !== "Unmapped" && !isPanel(selected)) {
    throw new HttpError(400, "Choose a department, Hidden, or Unmapped.");
  }

  const db = await getDb();
  const key = failedTo.toLowerCase();
  await db.collection("department_mappings").deleteMany({ failedToKey: key });
  if (selected && selected !== "Unmapped") {
    await db.collection("department_mappings").insertOne({
      failedToKey: key,
      failedToLabel: failedTo,
      department: selected === "Hidden" ? null : selected,
      hidden: selected === "Hidden",
      defectTypeContains: selected === "Hidden" ? "" : defectTypeContains,
    });
  }
  const version = await bumpRuleVersion(db);
  const updated = await rederiveAll(db);
  res.json({
    updated,
    ruleVersion: version,
    appliesToEveryDefect: selected !== "Unmapped" && selected !== "Hidden" && appliesToEveryDefect,
  });
}));

app.get("/api/rules", wrap(async (_req, res) => {
  const db = await getDb();
  const rules = await db.collection("cleansing_rules").find({}).sort({ priority: 1, category: 1 }).toArray();
  res.json({
    rules: rules.map((rule) => ({
      id: String(rule._id),
      priority: rule.priority ?? 0,
      category: rule.category ?? "",
      enabled: rule.enabled !== false,
      commentAll: rule.commentAll ?? [],
      commentAny: rule.commentAny ?? [],
      commentAny2: rule.commentAny2 ?? [],
      machineAreaContains: rule.machineAreaContains ?? "",
      defectTypeContains: rule.defectTypeContains ?? "",
      checkTextContains: rule.checkTextContains ?? "",
      workCenters: rule.workCenters ?? [],
      excludeCommentContains: rule.excludeCommentContains ?? [],
      notes: rule.notes ?? "",
    })),
  });
}));

app.post("/api/rules", wrap(async (req, res) => {
  const rule = ruleFromBody(req.body);
  const db = await getDb();
  const inserted = await db.collection("cleansing_rules").insertOne(rule);
  const version = await bumpRuleVersion(db);
  const updated = await rederiveAll(db);
  res.status(201).json({ id: String(inserted.insertedId), updated, ruleVersion: version });
}));

app.put("/api/rules/:id", wrap(async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) throw new HttpError(400, "Unknown rule.");
  const rule = ruleFromBody(req.body);
  const db = await getDb();
  const result = await db.collection("cleansing_rules").updateOne({ _id: new ObjectId(req.params.id) }, { $set: rule });
  if (!result.matchedCount) throw new HttpError(404, "Rule not found.");
  const version = await bumpRuleVersion(db);
  const updated = await rederiveAll(db);
  res.json({ updated, ruleVersion: version });
}));

app.delete("/api/rules/:id", wrap(async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) throw new HttpError(400, "Unknown rule.");
  const db = await getDb();
  const result = await db.collection("cleansing_rules").deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount) throw new HttpError(404, "Rule not found.");
  const version = await bumpRuleVersion(db);
  const updated = await rederiveAll(db);
  res.json({ updated, ruleVersion: version });
}));

app.get("/api/audits/:kind", wrap(async (req, res) => {
  const kind = req.params.kind;
  const collections: Record<string, string> = {
    excluded: "excluded_records",
    duplicates: "duplicate_audits",
    operational: "operational_reviews",
  };
  const name = collections[kind];
  if (!name) throw new HttpError(404, "Unknown audit.");
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
  const db = await getDb();
  const collection = db.collection(name);
  const total = await collection.countDocuments();
  const docs = await collection
    .find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  res.json({
    total,
    page,
    pageSize,
    rows: docs.map((doc) => ({ ...publicAudit(doc), id: String(doc._id) })),
  });
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof MongoServerError && error.code === 11000) {
    res.status(409).json({ error: "That record is already stored." });
    return;
  }
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Server error";
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

function ruleFromBody(body: unknown): Rule {
  const input = (body ?? {}) as Record<string, unknown>;
  const rule = emptyRule({
    priority: Number(input.priority),
    category: String(input.category ?? "").trim(),
    enabled: input.enabled !== false && input.enabled !== "false",
    commentAll: splitList(input.commentAll),
    commentAny: splitList(input.commentAny),
    commentAny2: splitList(input.commentAny2),
    machineAreaContains: String(input.machineAreaContains ?? "").trim(),
    defectTypeContains: String(input.defectTypeContains ?? "").trim(),
    checkTextContains: String(input.checkTextContains ?? "").trim(),
    workCenters: splitList(input.workCenters),
    excludeCommentContains: splitList(input.excludeCommentContains),
    notes: String(input.notes ?? "").trim(),
  });
  if (!rule.category) throw new HttpError(400, "A category name is required.");
  if (!Number.isFinite(rule.priority)) throw new HttpError(400, "Priority must be a number. Lower numbers run first.");
  const hasSignal = Boolean(
    rule.commentAll.length ||
      rule.commentAny.length ||
      rule.commentAny2.length ||
      rule.checkTextContains ||
      rule.defectTypeContains,
  );
  if (!hasSignal) {
    throw new HttpError(400, "Add comment text, check text, or a defect type so the rule cannot match every fault.");
  }
  return rule;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicAudit(doc: Document): Document {
  const { _id, ...rest } = doc;
  return rest;
}

async function ensureSetup(): Promise<void> {
  const db = await getDb();
  await db.collection("faults").createIndex({ rowHash: 1 }, { unique: true });
  await db.collection("faults").createIndex({ eventKey: 1 });
  await db.collection("faults").createIndex({ month: 1, weekCommencing: 1 });
  await db.collection("faults").createIndex({ executiveDepartment: 1, weekCommencing: 1, cleansedFault: 1 });
  await db.collection("faults").createIndex({ failedTo: 1 });
  await db.collection("excluded_records").createIndex({ rowHash: 1 }, { unique: true });
  await db.collection("duplicate_audits").createIndex({ importBatchId: 1 });
  await db.collection("operational_reviews").createIndex({ importBatchId: 1 });
  await db.collection("department_mappings").createIndex({ failedToKey: 1, defectTypeContains: 1 });

  const settings = await db.collection("settings").findOne({ _id: "app" as unknown as ObjectId });
  if (!settings) {
    await db.collection("cleansing_rules").insertMany(seedRules());
    await db.collection("department_mappings").insertMany(seedMappings());
    await db.collection("settings").insertOne({ _id: "app" as unknown as ObjectId, ruleVersion: 1, extendedMappings: true });
    return;
  }

  // One-time top-up for databases created before the extended mappings existed.
  // It adds only the pairs that are missing, then never runs again, so a mapping
  // someone clears later on the Departments page stays cleared.
  if (!settings.extendedMappings) {
    const existing = await db.collection("department_mappings").find({}).toArray();
    const have = new Set(existing.map((doc) => `${doc.failedToKey}||${String(doc.defectTypeContains ?? "").toLowerCase()}`));
    const missing = extendedMappings().filter((item) => !have.has(`${item.failedToKey}||${item.defectTypeContains.toLowerCase()}`));
    if (missing.length) await db.collection("department_mappings").insertMany(missing);
    await db.collection("settings").updateOne({ _id: "app" as unknown as ObjectId }, { $set: { extendedMappings: true } });
    await bumpRuleVersion(db);
    const updated = await rederiveAll(db);
    console.log(`Mapped ${missing.length} more Failed To values and refreshed ${updated} faults.`);
  }
}

ensureSetup()
  .then(() => {
    app.listen(port, () => {
      const account = os.userInfo().username;
      console.log(`Started by ${account} on ${os.hostname()}`);
      console.log(`DPU API listening on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not start the DPU API.", error);
    process.exit(1);
  });
