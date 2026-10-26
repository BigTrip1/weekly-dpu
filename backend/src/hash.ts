import { createHash } from "node:crypto";
import type { SourceFields } from "./types.js";
import { canonText } from "./text.js";

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

export function rowFingerprint(row: SourceFields): string {
  return fingerprint([
    canonText(row.orderNumber),
    canonText(row.buildNumber),
    canonText(row.serialNumber),
    canonText(row.model),
    canonText(row.workCenter),
    canonText(row.checkText),
    canonText(row.comments),
    canonText(row.failedTo),
    canonText(row.machineArea),
    canonText(row.defectType),
    canonText(row.failedBy),
    row.failedDate,
    row.failedTime,
    canonText(row.fixedBy),
    row.fixedDate,
    row.fixedTime,
    canonText(row.fix),
  ]);
}

export function eventFingerprint(row: SourceFields): string {
  return fingerprint([
    canonText(row.orderNumber),
    canonText(row.buildNumber),
    canonText(row.serialNumber),
    canonText(row.workCenter),
    canonText(row.checkText),
    canonText(row.comments),
    canonText(row.failedTo),
    canonText(row.machineArea),
    canonText(row.defectType),
    row.failedDate,
    row.failedTime,
  ]);
}
