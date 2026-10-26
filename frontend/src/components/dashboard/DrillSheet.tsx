import { useMemo, useState } from "react";
import { CheckCircle2Icon, CircleDashedIcon, SearchIcon } from "lucide-react";

import type { DrillRow } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt } from "@/format";
import { departmentColor } from "@/lib/departments";

type Props = {
  open: boolean;
  department: string;
  fault: string;
  periodLabel: string;
  rows: DrillRow[] | null;
  total: number;
  loading: boolean;
  onClose: () => void;
};

function haystack(row: DrillRow): string {
  return [row.buildNumber, row.model, row.serialNumber, row.workCenter, row.failedBy, row.comments, row.failedTo, row.machineArea, row.defectType]
    .join(" ")
    .toLowerCase();
}

export function DrillSheet({ open, department, fault, periodLabel, rows, total, loading, onClose }: Props) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!rows || !needle) return rows;
    return rows.filter((row) => haystack(row).includes(needle));
  }, [rows, query]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          onClose();
        }
      }}
    >
      <SheetContent aria-label="Fault drill-down">
        <SheetHeader>
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: departmentColor(department) }} aria-hidden="true" />
            {department}
          </div>
          <SheetTitle>{fault || `All ${department} faults`}</SheetTitle>
          <SheetDescription>
            {formatInt(total)} source {total === 1 ? "record" : "records"} for {periodLabel}. The original comment sits beside the cleansed category.
            {rows && rows.length < total && ` Showing the first ${formatInt(rows.length)}.`}
          </SheetDescription>
        </SheetHeader>
        <div className="px-6">
          <div className="relative max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search build, comment, area, recorded by"
              className="pl-9"
              aria-label="Search source records"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          {loading && (
            <div className="grid gap-2" aria-busy="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          )}
          {!loading && shown && (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table containerClassName="max-h-[calc(100vh-15rem)] overflow-auto">
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Build</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Work centre</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead>Original comment</TableHead>
                    <TableHead>Cleansed fault</TableHead>
                    <TableHead>Failed to</TableHead>
                    <TableHead>Machine area</TableHead>
                    <TableHead>Defect type</TableHead>
                    <TableHead>Closure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((row) => (
                    <TableRow key={row.id} className="text-[13px]">
                      <TableCell className="font-mono font-semibold whitespace-nowrap">{row.buildNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.model}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap">{row.serialNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.workCenter}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {row.failedDate}
                        <span className="block text-xs text-muted-foreground">{row.failedTime}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.failedBy || "—"}</TableCell>
                      <TableCell className="min-w-[12rem]">{row.comments || "—"}</TableCell>
                      <TableCell className="min-w-[10rem] font-semibold">{row.cleansedFault}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.failedTo}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.machineArea}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.defectType}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.closureStatus === "Fixed" ? (
                          <Badge variant="down">
                            <CheckCircle2Icon /> Fixed
                          </Badge>
                        ) : (
                          <Badge variant="warn">
                            <CircleDashedIcon /> {row.closureStatus || "Open"}
                          </Badge>
                        )}
                        {row.fixedDate && <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">{row.fixedDate}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shown.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                        No source records match that search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
