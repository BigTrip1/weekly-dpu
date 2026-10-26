import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HEADERS = [
  "order_number",
  "build_number",
  "serial_number",
  "model",
  "work_center",
  "check_text",
  "comments",
  "failed_to",
  "machine_area",
  "defect_type",
  "failed_by",
  "failed_date",
  "failed_time",
  "fixed_by",
  "faxed_date",
  "fixed_time",
  "fix",
] as const;

type MockRow = [
  string, string, string, string, string, string, string, string, string, string,
  string, Date | string, string, string, Date | string, string, string,
];

const INSPECTORS = ["Alex Morgan", "Sam Patel", "Jordan Blake", "Riley Chen", "Casey Quinn"];
const MODELS = ["532X70AG", "540-170", "3CX-MOCK", "535-125"];
const CENTRES = ["Q5MOCK1", "Q5MOCK2", "Q5MOCK3", "Q5MOCK4"];

const TEMPLATES: Array<[string, string, string, string, string]> = [
  ["Shot & Paint", "Boom", "Incomplete", "Additional findings", "boom wax oil poor coverage"],
  ["Shot & Paint", "Chassis", "Incomplete", "Additional findings", "N/S O/S Sealant missed"],
  ["Cab Systems", "Hvac - Heater", "Loose", "Additional findings", "14mm heater tap nut loose"],
  ["Cab Systems", "Door", "Foul", "Additional findings", "top door fouls on lock back"],
  ["Cab Systems", "Fusebox", "Missing", "Additional findings", "fuse cover missing"],
  ["Supplier Quality", "Ac System", "Inoperative", "Additional findings", "ac not cold enough, temperature above 9.9"],
  ["Supplier Quality", "Ac System", "Leaking", "Additional findings", "a/c leak"],
  ["Zone 5", "Transmission Oil", "High (fluid)", "Additional findings", "transmission oil overfilled"],
  ["Zone 6", "Harness", "Loose", "Additional findings", "harness not secured"],
  ["Materials", "Wheels", "Shortage", "Additional findings", "slaved wheels fitted"],
  ["Logistics", "Cooler", "Shortage", "Additional findings", "fuel cooler bracket shortage"],
  ["Chassis Manufacturing", "Chassis", "Misaligned", "Additional findings", "rear chassis arm out of line"],
  ["Finishing Ldl", "Door", "Paint", "Additional findings", "paint run on the door"],
  ["Finishing Ldl", "Trim", "Loose", "Additional findings", "trim clip loose"],
  ["Zone 2", "Step", "Damaged", "Additional findings", "mock scuff on the cab step"],
  ["Zone 7", "Boom", "Loose", "Additional findings", "mock pin loose on the boom"],
  ["Maintenance", "General", "Incomplete", "Additional findings", "mock area left unfinished"],
  ["Man Eng", "Engine", "Leak", "Additional findings", "engine oil weep"],
  ["Design", "Drawing", "Incorrect", "Additional findings", "hole position not to drawing"],
];

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function atUtc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let cursor = new Date(start.getTime()); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor.getTime()));
  }
  return days;
}

function timeOf(random: () => number): string {
  const hour = 6 + Math.floor(random() * 12);
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  return `${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}`;
}

export function buildMockRows(): MockRow[] {
  const random = mulberry32(20260101);
  const days = eachDay(atUtc(2026, 0, 1), atUtc(2026, 9, 26));
  const rows: MockRow[] = [];
  let serial = 3600000;

  days.forEach((day, dayIndex) => {
    const count = 6 + (dayIndex % 5);
    for (let slot = 0; slot < count; slot += 1) {
      const template = TEMPLATES[Math.floor(random() * TEMPLATES.length)];
      const [failedTo, area, defect, check, comment] = template;
      const sequence = rows.length + 1;
      const inspector = INSPECTORS[sequence % INSPECTORS.length];
      const closed = random() < 0.35;
      const failedTime = timeOf(random);
      const fixedDate = closed ? addDays(day, 1 + Math.floor(random() * 2)) : "";
      rows.push([
        `MOCKORD${pad(10000 + sequence, 6)}`,
        `MOCK-${day.getUTCFullYear()}-${pad(sequence, 5)}`,
        String(serial),
        MODELS[sequence % MODELS.length],
        CENTRES[sequence % CENTRES.length],
        check,
        comment,
        failedTo,
        area,
        defect,
        inspector,
        new Date(day.getTime()),
        failedTime,
        closed ? inspector : "",
        fixedDate,
        closed ? failedTime : "",
        closed ? "Closed on mock retest" : "",
      ]);
      serial += 1;
    }
  });

  const duplicate = rows[40];
  rows.push([...duplicate]);
  rows.push([...rows[41]]);
  rows.push([...rows[120]]);

  const invalid = [...rows[10]] as MockRow;
  invalid[0] = "MOCKORD-BADDATE";
  invalid[1] = "MOCK-BADDATE";
  invalid[11] = "not-a-date";
  rows.push(invalid);

  return rows;
}

export async function writeMockWorkbook(filePath: string): Promise<number> {
  const rows = buildMockRows();
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Faults");
  sheet.addRow([...HEADERS]);
  for (const row of rows) sheet.addRow(row);
  sheet.getColumn(12).numFmt = "yyyy-mm-dd";
  sheet.getColumn(15).numFmt = "yyyy-mm-dd";
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await book.xlsx.writeFile(filePath);
  return rows.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const destination = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../samples/mock-faults-jan-2026-to-date.xlsx");
  writeMockWorkbook(destination)
    .then((count) => {
      console.log(`Wrote ${count} mock faults to ${destination}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
