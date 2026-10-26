import { InboxIcon } from "lucide-react";

import type { DashboardResponse } from "@/api";
import { CountTrend, ShareTrend } from "@/components/TrendBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt, formatShare } from "@/format";
import { departmentColor } from "@/lib/departments";

type Panel = DashboardResponse["panels"][number];

type Props = {
  panel: Panel;
  periodTotal: number;
  /** Weekly view compares with the previous week. Monthly view compares with the previous month. */
  weekly: boolean;
  onOpen: (department: string, fault: string) => void;
};

export function DepartmentPanel({ panel, periodTotal, weekly, onOpen }: Props) {
  const color = departmentColor(panel.department);
  const periodShare = periodTotal ? (panel.total / periodTotal) * 100 : 0;

  return (
    <Card className="overflow-hidden" data-department={panel.department}>
      <div className="flex items-center gap-3 border-b border-border bg-jcb px-4 py-2.5 text-[#161616] dark:bg-card dark:text-foreground">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px] ring-2 ring-black/25 dark:ring-white/10" style={{ backgroundColor: color }} />
        <h2 className="font-display text-xl leading-none font-extrabold tracking-wide uppercase">{panel.department}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="border-black/30 bg-black/10 text-[#161616] dark:border-border dark:bg-muted dark:text-muted-foreground">
            {formatShare(periodShare)} of period
          </Badge>
          <span className="font-display text-lg leading-none font-bold tabular-nums">{formatInt(panel.total)} faults</span>
        </div>
      </div>
      <div className="h-0.5 w-full dark:bg-jcb" aria-hidden="true" />
      {panel.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
          <InboxIcon className="size-6 opacity-60" />
          No mapped faults in this period.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">#</TableHead>
              <TableHead>Cleansed inspector fault</TableHead>
              <TableHead className="text-right">{weekly ? "Prev week QTY" : "Prev month QTY"}</TableHead>
              <TableHead className="text-right">QTY</TableHead>
              <TableHead className="text-center">Trend</TableHead>
              <TableHead className="text-center">Share change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {panel.rows.map((row, index) => (
              <TableRow key={row.cleansedFault}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">{index + 1}</TableCell>
                <TableCell className="max-w-[18rem] min-w-[10rem]">
                  <button
                    type="button"
                    onClick={() => onOpen(panel.department, row.cleansedFault)}
                    className="cursor-pointer text-left font-semibold underline decoration-border decoration-1 underline-offset-4 transition-colors hover:text-primary-foreground hover:decoration-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:text-primary"
                    title={`Open ${row.cleansedFault}`}
                  >
                    {row.cleansedFault}
                  </button>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {row.previousCount == null ? "—" : formatInt(row.previousCount)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">{formatInt(row.count)}</TableCell>
                <TableCell className="text-center">
                  <CountTrend value={row.trend} />
                </TableCell>
                <TableCell className="text-center">
                  <ShareTrend value={row.shareChange} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
