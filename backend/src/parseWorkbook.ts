import { promises as fsp } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { closureStatus, excelSerialToISO, formatHMS, fractionToTime, localDateISO } from "./dates.js";
import { eventFingerprint, rowFingerprint } from "./hash.js";
import { canonText } from "./text.js";
import type { ParsedRow } from "./types.js";

const HEADER_KEYS = [
  "orderNumber",
  "buildNumber",
  "serialNumber",
  "model",
  "workCenter",
  "checkText",
  "comments",
  "failedTo",
  "machineArea",
  "defectType",
  "failedBy",
  "failedDate",
  "failedTime",
  "fixedBy",
  "fixedDate",
  "fixedTime",
  "fix",
] as const;

type HeaderKey = (typeof HEADER_KEYS)[number];

const HEADER_ALIASES: Record<string, HeaderKey> = {
  ordernumber: "orderNumber",
  buildnumber: "buildNumber",
  serialnumber: "serialNumber",
  model: "model",
  workcenter: "workCenter",
  workcentre: "workCenter",
  checktext: "checkText",
  comments: "comments",
  comment: "comments",
  failedto: "failedTo",
  machinearea: "machineArea",
  defecttype: "defectType",
  failedby: "failedBy",
  faileddate: "failedDate",
  failedtime: "failedTime",
  fixedby: "fixedBy",
  fixeddate: "fixedDate",
  faxeddate: "fixedDate",
  fixedtime: "fixedTime",
  fix: "fix",
};

function normHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function unwrap(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return unwrap(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
  }
  return value;
}

function asId(value: ExcelJS.CellValue): string {
  const raw = unwrap(value);
  if (raw == null) return "";
  if (raw instanceof Date) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) return String(raw);
    return String(raw);
  }
  return canonText(String(raw));
}

function asText(value: ExcelJS.CellValue): string {
  const raw = unwrap(value);
  if (raw == null) return "";
  if (raw instanceof Date) return canonText(raw.toISOString());
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) return String(raw);
    return canonText(String(raw));
  }
  return canonText(String(raw));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isoParts(year: number, month: number, day: number): string {
  if (year < 1901 || month < 1 || month > 12 || day < 1) return "";
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Dates as they appear in a CSV: Excel serial text, day first 14/10/2026, or 14-Oct-2026. */
function dateFromText(text: string): string {
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    return serial > 20000 && serial < 80000 ? excelSerialToISO(Math.floor(serial)) : "";
  }
  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\D.*)?$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return isoParts(year, Number(numeric[2]), Number(numeric[1]));
  }
  const named = text.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s,-]+(\d{2}|\d{4})(?:\D.*)?$/);
  if (named) {
    const month = MONTHS.indexOf(named[2].toLowerCase()) + 1;
    const year = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
    return month ? isoParts(year, month, Number(named[1])) : "";
  }
  return "";
}

export function parseDateValue(value: ExcelJS.CellValue): { iso: string; raw: string; valid: boolean } {
  const rawValue = unwrap(value);
  if (rawValue == null || rawValue === "") return { iso: "", raw: "", valid: false };
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    if (rawValue.getFullYear() < 1901) return { iso: "", raw: rawValue.toISOString(), valid: false };
    const iso = localDateISO(rawValue);
    return { iso, raw: iso, valid: /^\d{4}-\d{2}-\d{2}$/.test(iso) };
  }
  if (typeof rawValue === "number" && rawValue > 20000 && rawValue < 80000) {
    const iso = excelSerialToISO(rawValue);
    return { iso, raw: String(rawValue), valid: true };
  }
  const text = canonText(String(rawValue));
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matched) return { iso: `${matched[1]}-${matched[2]}-${matched[3]}`, raw: text, valid: true };
  const fromText = dateFromText(text);
  if (fromText) return { iso: fromText, raw: text, valid: true };
  return { iso: "", raw: text, valid: false };
}

export function parseTimeValue(value: ExcelJS.CellValue): string {
  const raw = unwrap(value);
  if (raw == null || raw === "") return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return formatHMS(raw);
  if (typeof raw === "number" && Number.isFinite(raw)) return fractionToTime(raw);
  const text = String(raw).trim();
  if (/^\d*\.\d+$/.test(text) && Number(text) < 1) return fractionToTime(Number(text));
  const matched = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (!matched) return "";
  let hour = Number(matched[1]);
  if (matched[4]) {
    const pm = matched[4].toLowerCase() === "pm";
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const hh = String(hour).padStart(2, "0");
  const mm = matched[2].padStart(2, "0");
  const ss = (matched[3] ?? "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function findHeader(sheet: ExcelJS.Worksheet): { rowNumber: number; columns: Map<HeaderKey, number> } | null {
  const limit = Math.min(sheet.rowCount || 15, 15);
  for (let rowNumber = 1; rowNumber <= Math.max(limit, 1); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columns = new Map<HeaderKey, number>();
    const max = Math.max(row.cellCount, 17);
    for (let col = 1; col <= max + 2; col += 1) {
      const text = asText(row.getCell(col).value);
      if (!text) continue;
      const key = HEADER_ALIASES[normHeader(text)];
      if (key && !columns.has(key)) columns.set(key, col);
    }
    if (columns.has("orderNumber") && columns.has("failedDate") && columns.has("comments")) {
      return { rowNumber, columns };
    }
  }
  return null;
}

function decodeCsv(buffer: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^\uFEFF/, "");
}

function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Array<[string, number]> = [",", ";", "\t", "|"].map((mark) => [mark, firstLine.split(mark).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Reads a faults extract saved as .xlsx or .csv. Every CSV value is kept as text. */
export async function parseWorkbook(filePath: string, originalName = filePath): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet | undefined;
  if (path.extname(originalName).toLowerCase() === ".csv") {
    const text = decodeCsv(await fsp.readFile(filePath));
    if (!text.trim()) throw new Error("The CSV file is empty.");
    sheet = await workbook.csv.read(Readable.from([text]), {
      map: (value: string) => (value === "" ? null : value),
      parserOptions: { delimiter: sniffDelimiter(text) },
    });
  } else {
    await workbook.xlsx.readFile(filePath);
    sheet = workbook.worksheets[0];
  }
  if (!sheet) throw new Error("The file has no sheet or rows.");
  return parseSheet(sheet);
}

function parseSheet(sheet: ExcelJS.Worksheet): ParsedRow[] {
  const header = findHeader(sheet);
  if (!header) {
    throw new Error("Could not find the faults header row. Expected the 17 source columns, including order number and failed date.");
  }

  const missing = HEADER_KEYS.filter((key) => !header.columns.has(key));
  if (missing.length) {
    throw new Error(`The file is missing columns: ${missing.join(", ")}. Fixed date may be headed faxed_date.`);
  }

  const rows: ParsedRow[] = [];
  const last = sheet.rowCount;
  for (let rowNumber = header.rowNumber + 1; rowNumber <= last; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const cell = (key: HeaderKey) => excelRow.getCell(header.columns.get(key) as number).value;
    const orderNumber = asId(cell("orderNumber"));
    const buildNumber = asText(cell("buildNumber"));
    const serialNumber = asId(cell("serialNumber"));
    const model = asText(cell("model"));
    const workCenter = asText(cell("workCenter"));
    const checkText = asText(cell("checkText"));
    const comments = asText(cell("comments"));
    const failedTo = asText(cell("failedTo"));
    const machineArea = asText(cell("machineArea"));
    const defectType = asText(cell("defectType"));
    const failedBy = asText(cell("failedBy"));
    const failed = parseDateValue(cell("failedDate"));
    const failedTime = parseTimeValue(cell("failedTime"));
    const fixedBy = asText(cell("fixedBy"));
    const fixed = parseDateValue(cell("fixedDate"));
    const fixedTime = parseTimeValue(cell("fixedTime"));
    const fix = asText(cell("fix"));

    const blankRow = [
      orderNumber,
      buildNumber,
      serialNumber,
      model,
      workCenter,
      checkText,
      comments,
      failedTo,
      machineArea,
      defectType,
      failedBy,
      failed.raw,
      failedTime,
      fixedBy,
      fixed.raw,
      fixedTime,
      fix,
    ].every((value) => !value);
    if (blankRow) continue;

    let exclusionReason: string | null = null;
    if (!comments && !failedTo && !machineArea && !defectType) {
      exclusionReason = "No inspector comment, allocation, machine area, or defect type";
    } else if (!failed.valid) {
      exclusionReason = "Invalid or unreadable Failed Date";
    }

    const source = {
      orderNumber,
      buildNumber,
      serialNumber,
      model,
      workCenter,
      checkText,
      comments,
      failedTo,
      machineArea,
      defectType,
      failedBy,
      failedDate: failed.valid ? failed.iso : "",
      failedTime,
      fixedBy,
      fixedDate: fixed.valid ? fixed.iso : "",
      fixedTime,
      fix,
    };

    rows.push({
      ...source,
      sourceRow: rowNumber,
      failedDateRaw: failed.raw,
      exclusionReason,
      rowHash: rowFingerprint(source),
      eventKey: eventFingerprint(source),
    });
  }

  if (!rows.length) throw new Error("The file has a header but no fault rows.");
  return rows;
}

export function closureOf(fixedDate: string): "Open" | "Fixed" {
  return closureStatus(fixedDate);
}
