import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlertIcon, EyeOffIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";

import { getMappingFaults, getMappings, saveMapping, type MappingFault, type MappingRow } from "@/api";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt } from "@/format";
import { departmentColor } from "@/lib/departments";
import { cn } from "@/lib/utils";

const HIDDEN = "Hidden";
const UNMAPPED = "Unmapped";

type Draft = { department: string; defectTypeContains: string };
type Filter = "all" | "unmapped" | "mapped" | "hidden";

function savedDraft(row: MappingRow): Draft {
  return { department: row.hidden ? HIDDEN : row.department || UNMAPPED, defectTypeContains: row.defectTypeContains };
}

function DepartmentDot({ name }: { name: string }) {
  if (name === UNMAPPED) return <span className="size-2.5 shrink-0 rounded-full border border-muted-foreground/60" aria-hidden="true" />;
  if (name === HIDDEN) return <EyeOffIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
  return <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: departmentColor(name) }} aria-hidden="true" />;
}

export function Mappings() {
  const [panels, setPanels] = useState<string[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openFailedTo, setOpenFailedTo] = useState<string | null>(null);
  const [faultPage, setFaultPage] = useState(1);
  const [faults, setFaults] = useState<MappingFault[]>([]);
  const [faultTotal, setFaultTotal] = useState(0);
  const [faultPageSize, setFaultPageSize] = useState(25);
  const [faultsLoading, setFaultsLoading] = useState(false);
  const [faultRefresh, setFaultRefresh] = useState(0);

  function load() {
    getMappings()
      .then((result) => {
        setPanels(result.panels);
        setRows(result.rows);
        const next: Record<string, Draft> = {};
        for (const row of result.rows) next[row.failedTo] = savedDraft(row);
        setDrafts(next);
        setLoaded(true);
      })
      .catch((reason: Error) => {
        setError(reason.message);
        setLoaded(true);
      });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openFailedTo) return;
    let active = true;
    setFaultsLoading(true);
    getMappingFaults(openFailedTo, faultPage)
      .then((result) => {
        if (!active) return;
        setFaults(result.rows);
        setFaultTotal(result.total);
        setFaultPageSize(result.pageSize);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setFaultsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [openFailedTo, faultPage, faultRefresh]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      unmapped: rows.filter((row) => row.status === "unmapped").length,
      mapped: rows.filter((row) => row.status === "panel").length,
      hidden: rows.filter((row) => row.status === "hidden").length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "unmapped" && row.status !== "unmapped") return false;
      if (filter === "mapped" && row.status !== "panel") return false;
      if (filter === "hidden" && row.status !== "hidden") return false;
      return !needle || row.failedTo.toLowerCase().includes(needle);
    });
  }, [rows, query, filter]);

  async function onSave(row: MappingRow) {
    const draft = drafts[row.failedTo];
    if (!draft) return;
    setSaving(row.failedTo);
    setError("");
    try {
      const defectFilter = draft.defectTypeContains.trim();
      const result = await saveMapping({
        failedTo: row.failedTo,
        department: draft.department,
        defectTypeContains: defectFilter,
      });
      const scope = result.appliesToEveryDefect
        ? `Every ${row.failedTo} fault is assigned to ${draft.department}`
        : defectFilter
          ? `${row.failedTo} faults are assigned to ${draft.department} only when the defect type contains “${defectFilter}”`
          : `${row.failedTo} is now ${draft.department}`;
      toast.success(scope, { description: `Reporting fields updated on ${formatInt(result.updated)} faults.` });
      if (openFailedTo === row.failedTo) setFaultRefresh((value) => value + 1);
      load();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not save the mapping";
      setError(message);
      toast.error("Mapping not saved", { description: message });
    } finally {
      setSaving("");
    }
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "unmapped", label: "Unmapped", count: counts.unmapped },
    { id: "mapped", label: "Mapped", count: counts.mapped },
    { id: "hidden", label: "Hidden", count: counts.hidden },
  ];

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Department mapping"
        description="Failed To stays as it was recorded. Choose an executive department and press Save. Leave “Only when defect contains” blank to assign every fault with that Failed To. Type a word, such as paint, only when the department should apply to matching defect types. Click a fault count to review the individual records."
      />

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Failed To" className="pl-9" aria-label="Search Failed To" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-bold tracking-wide uppercase transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                filter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-1.5 font-mono text-[11px] tabular-nums", filter === item.id ? "bg-black/15" : "bg-muted")}>{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {!loaded ? (
          <div className="grid gap-2 p-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Failed To</TableHead>
                <TableHead className="text-right">Faults</TableHead>
                <TableHead className="min-w-[14rem]">Executive department</TableHead>
                <TableHead className="min-w-[12rem]">Only when defect contains</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const saved = savedDraft(row);
                const draft = drafts[row.failedTo] ?? saved;
                const dirty = draft.department !== saved.department || draft.defectTypeContains.trim() !== saved.defectTypeContains.trim();
                const open = openFailedTo === row.failedTo;
                return (
                  <Fragment key={row.failedTo}>
                    <TableRow className={cn(open && "bg-accent/50")}>
                      <TableCell className="font-semibold">
                        <span className="flex items-center gap-2">
                          <DepartmentDot name={saved.department} />
                          {row.failedTo}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          aria-expanded={open}
                          className={cn(
                            "cursor-pointer rounded-md px-2 py-0.5 font-mono font-semibold tabular-nums underline decoration-border underline-offset-4 transition-colors hover:bg-primary hover:text-primary-foreground hover:no-underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                            open && "bg-primary text-primary-foreground no-underline",
                          )}
                          onClick={() => {
                            setOpenFailedTo((current) => (current === row.failedTo ? null : row.failedTo));
                            setFaultPage(1);
                          }}
                        >
                          {formatInt(row.count)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Select value={draft.department} onValueChange={(value) => setDrafts((current) => ({ ...current, [row.failedTo]: { ...draft, department: value } }))}>
                          <SelectTrigger aria-label={`Department for ${row.failedTo}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNMAPPED}>Unmapped</SelectItem>
                            <SelectItem value={HIDDEN}>Hidden</SelectItem>
                            {panels.map((panel) => (
                              <SelectItem key={panel} value={panel}>
                                {panel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.defectTypeContains}
                          placeholder="All defects"
                          aria-label={`Defect filter for ${row.failedTo}`}
                          onChange={(event) => setDrafts((current) => ({ ...current, [row.failedTo]: { ...draft, defectTypeContains: event.target.value } }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={!dirty || saving === row.failedTo} onClick={() => onSave(row)}>
                          {saving === row.failedTo && <Loader2Icon className="animate-spin" />}
                          {saving === row.failedTo ? "Saving…" : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-background/60 hover:bg-background/60">
                        <TableCell colSpan={5} className="p-0">
                          <FaultDrill
                            failedTo={row.failedTo}
                            rows={faults}
                            total={faultTotal}
                            page={faultPage}
                            pageSize={faultPageSize}
                            loading={faultsLoading}
                            onPage={setFaultPage}
                            onClose={() => setOpenFailedTo(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No Failed To values match that search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </main>
  );
}

function departmentLabel(row: MappingFault): string {
  if (row.executiveDepartment) return row.executiveDepartment;
  if (row.mappingStatus === "hidden") return "Hidden";
  return "Unmapped";
}

function FaultDrill({
  failedTo,
  rows,
  total,
  page,
  pageSize,
  loading,
  onPage,
  onClose,
}: {
  failedTo: string;
  rows: MappingFault[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPage: (page: number) => void;
  onClose: () => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="border-l-4 border-primary bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <strong className="font-display text-xl tracking-wide uppercase">{failedTo}</strong>
          <Badge variant="outline">
            {formatInt(total)} individual {total === 1 ? "fault" : "faults"}
          </Badge>
          {loading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon /> Close
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table containerClassName="max-h-[420px] overflow-auto">
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead>Build</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Original comment</TableHead>
              <TableHead>Machine area</TableHead>
              <TableHead>Defect type</TableHead>
              <TableHead>Cleansed fault</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Closure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((fault) => (
              <TableRow key={fault.id} className="text-[13px]">
                <TableCell className="font-mono font-semibold whitespace-nowrap">{fault.buildNumber}</TableCell>
                <TableCell className="whitespace-nowrap">{fault.model}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {fault.failedDate}
                  {fault.failedTime && <span className="block text-xs text-muted-foreground">{fault.failedTime}</span>}
                </TableCell>
                <TableCell className="min-w-[12rem]">{fault.comments || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{fault.machineArea}</TableCell>
                <TableCell className="whitespace-nowrap">{fault.defectType}</TableCell>
                <TableCell className="min-w-[10rem] font-semibold">{fault.cleansedFault}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <DepartmentDot name={departmentLabel(fault)} />
                    {departmentLabel(fault)}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={fault.closureStatus === "Fixed" ? "down" : "warn"}>{fault.closureStatus || "Open"}</Badge>
                  {fault.fixedDate && <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">{fault.fixedDate}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageCount={pages} onPageChange={onPage} total={total} className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground" />
    </div>
  );
}
