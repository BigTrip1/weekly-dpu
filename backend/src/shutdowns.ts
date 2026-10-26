import type { Db } from "mongodb";
import { weekCommencing } from "./dates.js";

export type ShutdownWeek = { week: string; reason: string };

// JCB production holidays and shutdowns, as the Monday of each week left out of the charts.
// The whole week is left out. Single bank holidays are not listed, and neither is a shutdown shorter
// than five days, such as the four-day Whitsun shutdown in 2027.
export const SHUTDOWNS_2026: ShutdownWeek[] = [
  { week: "2026-05-25", reason: "Spring Bank Holiday and Whitsun shutdown" },
  { week: "2026-07-20", reason: "Summer shutdown" },
  { week: "2026-07-27", reason: "Summer shutdown" },
  { week: "2026-08-03", reason: "Summer shutdown" },
  { week: "2026-09-28", reason: "Autumn shutdown" },
  { week: "2026-12-28", reason: "Christmas shutdown" },
];

export const SHUTDOWNS_2027: ShutdownWeek[] = [
  { week: "2027-07-26", reason: "Summer shutdown" },
  { week: "2027-08-02", reason: "Summer shutdown" },
  { week: "2027-08-09", reason: "Summer shutdown" },
  { week: "2027-09-27", reason: "Autumn shutdown" },
  { week: "2027-12-27", reason: "Christmas shutdown" },
];

// Each batch is added once, tracked by a settings flag, so a week removed later stays removed.
const BATCHES: { flag: string; weeks: ShutdownWeek[] }[] = [
  { flag: "shutdowns2026", weeks: SHUTDOWNS_2026 },
  { flag: "shutdowns2027", weeks: SHUTDOWNS_2027 },
];

const COLLECTION = "shutdown_weeks";

/** Adds each year's list once. After that the list belongs to the user. */
export async function seedShutdowns(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ week: 1 }, { unique: true });
  for (const batch of BATCHES) {
    const flag = await db.collection("settings").findOne({ _id: batch.flag as never });
    if (flag) continue;
    for (const item of batch.weeks) {
      await db.collection(COLLECTION).updateOne({ week: item.week }, { $setOnInsert: item }, { upsert: true });
    }
    await db.collection("settings").insertOne({ _id: batch.flag as never, seeded: true });
  }
}

export async function listShutdowns(db: Db): Promise<ShutdownWeek[]> {
  const rows = await db.collection(COLLECTION).find({}).sort({ week: 1 }).toArray();
  return rows.map((row) => ({ week: String(row.week), reason: String(row.reason ?? "") }));
}

export async function shutdownMap(db: Db): Promise<Map<string, string>> {
  return new Map((await listShutdowns(db)).map((item) => [item.week, item.reason]));
}

/** Accepts any date inside the week and stores the Monday that week commences. */
export async function addShutdown(db: Db, date: string, reason: string): Promise<ShutdownWeek> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error("Choose a date in the week to leave out.");
  }
  const week = weekCommencing(date);
  const item = { week, reason: reason.trim().slice(0, 80) || "Shutdown" };
  await db.collection(COLLECTION).updateOne({ week }, { $set: item }, { upsert: true });
  return item;
}

export async function removeShutdown(db: Db, week: string): Promise<boolean> {
  const result = await db.collection(COLLECTION).deleteOne({ week });
  return result.deletedCount > 0;
}
