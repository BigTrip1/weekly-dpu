import { useEffect, useState } from "react";
import { CircleAlertIcon, InboxIcon } from "lucide-react";

import { getAudit } from "@/api";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInt, formatWhen } from "@/format";

const tabs = [
  { id: "excluded", label: "Excluded records" },
  { id: "duplicates", label: "Exact duplicates" },
  { id: "operational", label: "Operational review" },
] as const;

type Kind = (typeof tabs)[number]["id"];
type Row = Record<string, unknown>;

export function Audits() {
  const [kind, setKind] = useState<Kind>("excluded");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Partial<Record<Kind, number>>>({});

  useEffect(() => {
    let active = true;
    for (const tab of tabs) {
      getAudit(tab.id, 1)
        .then((result) => {
          if (active) setCounts((current) => ({ ...current, [tab.id]: result.total }));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAudit(kind, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setPageSize(result.pageSize);
        setCounts((current) => ({ ...current, [kind]: result.total }));
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Audit"
        description="Excluded rows and exact copies stay available here. Operational review lists faults that share a machine, checkpoint, comment, and failure time but differ somewhere else. Those rows stay in the counts. Names in that review are for traceability only."
      />

      <Tabs
        value={kind}
        onValueChange={(next) => {
          setKind(next as Kind);
          setPage(1);
        }}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {counts[tab.id] != null && (
                <span className="rounded-full bg-black/15 px-1.5 font-mono text-[11px] tabular-nums data-[inactive=true]:bg-muted" data-inactive={tab.id !== kind}>
                  {formatInt(counts[tab.id] ?? 0)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <Card className="grid gap-2 p-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="items-center gap-2 px-6 py-14 text-center text-sm text-muted-foreground">
          <InboxIcon className="size-7 opacity-60" />
          No records in this list.
        </Card>
      ) : kind === "operational" ? (
        <Operational rows={rows} />
      ) : (
        <Simple kind={kind} rows={rows} />
      )}

      <Pagination page={page} pageCount={pages} onPageChange={setPage} total={total} />
    </main>
  );
}

function Simple({ kind, rows }: { kind: Kind; rows: Row[] }) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>When</TableHead>
            <TableHead>Source row</TableHead>
            <TableHead>Build</TableHead>
            <TableHead>{kind === "duplicates" ? "Retained row" : "Reason"}</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead>Failed to</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.id)}>
              <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                {formatWhen(typeof row.createdAt === "string" ? row.createdAt : null)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">{String(kind === "duplicates" ? (row.removedSourceRow ?? "") : (row.sourceRow ?? ""))}</TableCell>
              <TableCell className="font-mono font-semibold whitespace-nowrap">{String(row.buildNumber ?? "")}</TableCell>
              <TableCell>
                {kind === "duplicates" ? (
                  <span className="font-mono tabular-nums">{String(row.retainedSourceRow ?? "")}</span>
                ) : (
                  <Badge variant="warn">{String(row.reason ?? "")}</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[28rem] truncate" title={String(row.comments ?? "")}>
                {String(row.comments ?? "") || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">{String(row.failedTo ?? "")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Operational({ rows }: { rows: Row[] }) {
  return (
    <div className="grid gap-4">
      {rows.map((row) => {
        const records = Array.isArray(row.records) ? (row.records as Row[]) : [];
        return (
          <Card key={String(row.id)} className="overflow-hidden">
            <CardHeader className="border-b border-border bg-primary py-2.5 text-primary-foreground">
              <strong className="font-display text-lg tracking-wide uppercase">{String(row.recordCount ?? records.length)} records</strong>
              <span className="text-xs">{String(row.reason ?? "")}</span>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Source row</TableHead>
                  <TableHead>Build</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Fixed</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Fixed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record, index) => (
                  <TableRow key={`${row.id}-${index}`}>
                    <TableCell className="font-mono tabular-nums">{String(record.sourceRow ?? "")}</TableCell>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">{String(record.buildNumber ?? "")}</TableCell>
                    <TableCell>{String(record.comments ?? "") || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {String(record.failedDate ?? "")} {String(record.failedTime ?? "")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{String(record.fixedDate ?? "")}</TableCell>
                    <TableCell className="whitespace-nowrap">{String(record.failedBy ?? "")}</TableCell>
                    <TableCell className="whitespace-nowrap">{String(record.fixedBy ?? "")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        );
      })}
    </div>
  );
}
