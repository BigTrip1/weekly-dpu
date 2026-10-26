import type { RecordQuery } from "@/api";

// What a chart mark hands to the records sheet.
export type DrillSpec = {
  eyebrow: string;
  title: string;
  color?: string;
  query: RecordQuery;
};
