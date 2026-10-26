import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2Icon, CircleAlertIcon, FileSpreadsheetIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";

import { getImports, uploadWorkbook, type ImportBatch, type ImportSummary } from "@/api";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt, formatWhen } from "@/format";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string) {
  if (status === "completed") return <Badge variant="down"><CheckCircle2Icon /> Completed</Badge>;
  if (status === "failed") return <Badge variant="up"><CircleAlertIcon /> Failed</Badge>;
  return <Badge variant="warn"><Loader2Icon className="animate-spin" /> {status || "Running"}</Badge>;
}

export function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    getImports()
      .then((result) => setHistory(result.rows))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function choose(next: File | null) {
    setError("");
    if (next && !next.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setError("Upload the faults extract as an .xlsx workbook.");
      return;
    }
    setFile(next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose the weekly faults workbook.");
      return;
    }
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const result = await uploadWorkbook(file);
      setSummary(result);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`Imported ${result.filename}`, {
        description: `${formatInt(result.inserted)} inserted, ${formatInt(result.exactDuplicatesSkipped)} exact duplicates skipped.`,
      });
      refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Upload failed";
      setError(message);
      toast.error("Upload failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const tiles = summary
    ? [
        { label: "Inserted", value: summary.inserted, hint: "New faults stored" },
        { label: "Exact duplicates skipped", value: summary.exactDuplicatesSkipped, hint: "Same 17 columns already stored" },
        { label: "Closure refreshed", value: summary.closureRefreshed, hint: "Fix details updated, not recounted" },
        { label: "Excluded", value: summary.excluded, hint: "Unreadable Failed Date or empty row" },
        { label: "Operational reviews", value: summary.operationalReviews, hint: "Same event, other fields differ" },
      ]
    : [];

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Upload faults"
        description="Each weekly extract is the raw A–Q file. Rows already stored with the same 17 columns are skipped. If the same fault comes back with a new fixed date, time, or rectifier comment, that closure is updated and the fault is not counted again."
      />

      <form onSubmit={onSubmit} className="grid gap-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose the .xlsx extract"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            dragging ? "border-primary bg-primary/10" : "border-input bg-card hover:border-primary/70 hover:bg-accent/50",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <FileSpreadsheetIcon className="size-10 text-primary" />
              <div>
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>
              </div>
            </>
          ) : (
            <>
              <UploadCloudIcon className="size-10 text-primary" />
              <div>
                <p className="font-display text-2xl font-bold tracking-wide uppercase">Drop the .xlsx extract here</p>
                <p className="text-sm text-muted-foreground">or click to browse. Order number through fix, with failed date as the reporting date.</p>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={busy || !file}>
            {busy ? <Loader2Icon className="animate-spin" /> : <UploadCloudIcon />}
            {busy ? "Importing…" : "Import workbook"}
          </Button>
          {file && !busy && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <XIcon /> Clear file
            </Button>
          )}
          {busy && <span className="text-sm text-muted-foreground">Reading the workbook, checking duplicates, and cleansing faults. Large files take a little while.</span>}
        </div>
      </form>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-down" /> {summary.filename}
            </CardTitle>
            <Button asChild size="sm">
              <Link to="/">Open the review</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-lg border border-border bg-background/50 p-4">
                  <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{tile.label}</p>
                  <p className="mt-1 font-display text-4xl leading-none font-extrabold tabular-nums">{formatInt(tile.value)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{tile.hint}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle>Import history</CardTitle>
        </CardHeader>
        {history.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inserted</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Closure</TableHead>
                <TableHead className="text-right">Excluded</TableHead>
                <TableHead className="text-right">Reviews</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatWhen(row.uploadedAt)}</TableCell>
                  <TableCell className="max-w-[24rem] truncate font-medium" title={row.filename}>{row.filename}</TableCell>
                  <TableCell>
                    {statusBadge(row.status)}
                    {row.error && <span className="ml-2 text-xs text-destructive">{row.error}</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.inserted)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.exactDuplicatesSkipped)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.closureRefreshed)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.excluded)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatInt(row.operationalReviews)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </main>
  );
}
