import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlertIcon, Loader2Icon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";

import { createRule, deleteRule, getRules, updateRule, type Rule } from "@/api";
import { ChipInput } from "@/components/ChipInput";
import { PageHeader } from "@/components/PageHeader";
import { ShutdownWeeks } from "@/components/ShutdownWeeks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatInt } from "@/format";

const blank: Rule = {
  priority: 200,
  category: "",
  enabled: true,
  commentAll: [],
  commentAny: [],
  commentAny2: [],
  machineAreaContains: "",
  defectTypeContains: "",
  checkTextContains: "",
  workCenters: [],
  excludeCommentContains: [],
  notes: "",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Rule>(blank);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState("");

  function load() {
    getRules()
      .then((result) => {
        setRules(result.rules);
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

  const nextPriority = useMemo(() => (rules.length ? Math.max(...rules.map((rule) => rule.priority)) + 2 : 10), [rules]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rules;
    return rules.filter((rule) =>
      [rule.category, rule.notes, ...rule.commentAll, ...rule.commentAny, ...rule.commentAny2].join(" ").toLowerCase().includes(needle),
    );
  }, [rules, query]);

  function openNew() {
    setDraft({ ...blank, priority: nextPriority });
    setError("");
    setSheetOpen(true);
  }

  function openEdit(rule: Rule) {
    setDraft({ ...rule });
    setError("");
    setSheetOpen(true);
  }

  function set<K extends keyof Rule>(key: K, value: Rule[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const rule: Rule = {
        ...draft,
        priority: Number(draft.priority),
        category: draft.category.trim(),
        machineAreaContains: draft.machineAreaContains.trim(),
        defectTypeContains: draft.defectTypeContains.trim(),
        checkTextContains: draft.checkTextContains.trim(),
        notes: draft.notes.trim(),
      };
      const result = rule.id ? await updateRule(rule.id, rule) : await createRule(rule);
      toast.success(rule.id ? "Rule updated" : "Rule added", { description: `Reporting fields updated on ${formatInt(result.updated)} faults.` });
      setSheetOpen(false);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the rule");
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(rule: Rule, enabled: boolean) {
    if (!rule.id) return;
    setToggling(rule.id);
    try {
      const result = await updateRule(rule.id, { ...rule, enabled });
      toast.success(`${rule.category} ${enabled ? "enabled" : "disabled"}`, { description: `Reporting fields updated on ${formatInt(result.updated)} faults.` });
      load();
    } catch (reason) {
      toast.error("Could not change the rule", { description: reason instanceof Error ? reason.message : undefined });
    } finally {
      setToggling("");
    }
  }

  async function onConfirmDelete() {
    if (!toDelete?.id) return;
    setDeleting(true);
    try {
      const result = await deleteRule(toDelete.id);
      toast.success(`Removed ${toDelete.category}`, { description: `Reporting fields updated on ${formatInt(result.updated)} faults.` });
      setToDelete(null);
      load();
    } catch (reason) {
      toast.error("Could not delete the rule", { description: reason instanceof Error ? reason.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Consolidation rules"
        description="Rules run in priority order. The first match becomes the cleansed fault. More specific rules should have a lower priority number. Constraints on machine area, defect type, check text, and work centre stop a broad word from absorbing a different fault. Saving recalculates every stored fault and leaves the original comment unchanged."
        actions={
          <Button onClick={openNew}>
            <PlusIcon /> Add rule
          </Button>
        }
      />

      <ShutdownWeeks />

      {error && !sheetOpen && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlertIcon className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search category, terms, notes" className="pl-9" aria-label="Search rules" />
        </div>
        <span className="text-sm text-muted-foreground">
          {formatInt(visible.length)} of {formatInt(rules.length)} rules
        </span>
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
                <TableHead className="w-20 text-right">Priority</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Constraint</TableHead>
                <TableHead className="w-24 text-center">Enabled</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((rule) => {
                const terms = [...rule.commentAll, ...rule.commentAny, ...rule.commentAny2];
                const constraint = [
                  rule.machineAreaContains,
                  rule.workCenters.join(", "),
                  rule.excludeCommentContains.length ? `not ${rule.excludeCommentContains[0]}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <TableRow key={rule.id} className={rule.enabled ? undefined : "opacity-55"}>
                    <TableCell className="text-right font-mono tabular-nums">{rule.priority}</TableCell>
                    <TableCell className="font-semibold">{rule.category}</TableCell>
                    <TableCell className="max-w-[26rem]">
                      <div className="flex flex-wrap gap-1">
                        {terms.slice(0, 4).map((term) => (
                          <Badge key={term} variant="secondary" className="font-normal">
                            {term}
                          </Badge>
                        ))}
                        {terms.length > 4 && <Badge variant="outline">+{terms.length - 4}</Badge>}
                        {terms.length === 0 && <span className="text-muted-foreground">{rule.defectTypeContains || rule.checkTextContains || "—"}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{constraint || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.enabled}
                        disabled={toggling === rule.id}
                        onCheckedChange={(checked) => onToggle(rule, checked)}
                        aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.category}`}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                        <PencilIcon /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToDelete(rule)}>
                        <Trash2Icon /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No rules match that search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="max-w-2xl">
          <SheetHeader>
            <SheetTitle>{draft.id ? "Edit rule" : "Add rule"}</SheetTitle>
            <SheetDescription>
              Type a term and press Enter. A term of three characters or fewer matches whole words. Longer terms match anywhere in the comment.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-4">
              <div className="grid gap-4 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
                <Field label="Priority">
                  <Input type="number" value={draft.priority} onChange={(event) => set("priority", Number(event.target.value))} />
                </Field>
                <Field label="Category">
                  <Input value={draft.category} onChange={(event) => set("category", event.target.value)} required />
                </Field>
                <div className="flex h-9 items-center gap-2">
                  <Switch checked={draft.enabled} onCheckedChange={(checked) => set("enabled", checked)} id="rule-enabled" />
                  <label htmlFor="rule-enabled" className="text-sm font-semibold">
                    Enabled
                  </label>
                </div>
              </div>
              <Field label="Comment must include all">
                <ChipInput value={draft.commentAll} onChange={(next) => set("commentAll", next)} placeholder="Every term must appear" />
              </Field>
              <Field label="Comment must include one">
                <ChipInput value={draft.commentAny} onChange={(next) => set("commentAny", next)} placeholder="Any one of these terms" />
              </Field>
              <Field label="And must also include one">
                <ChipInput value={draft.commentAny2} onChange={(next) => set("commentAny2", next)} placeholder="A second group, any one term" />
              </Field>
              <Field label="Comment must not include">
                <ChipInput value={draft.excludeCommentContains} onChange={(next) => set("excludeCommentContains", next)} placeholder="Terms that rule the comment out" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Machine area contains">
                  <Input value={draft.machineAreaContains} onChange={(event) => set("machineAreaContains", event.target.value)} />
                </Field>
                <Field label="Defect type contains">
                  <Input value={draft.defectTypeContains} onChange={(event) => set("defectTypeContains", event.target.value)} />
                </Field>
                <Field label="Check text contains">
                  <Input value={draft.checkTextContains} onChange={(event) => set("checkTextContains", event.target.value)} />
                </Field>
              </div>
              <Field label="Work centres">
                <ChipInput value={draft.workCenters} onChange={(next) => set("workCenters", next)} placeholder="Limit to these work centres" />
              </Field>
              <Field label="Notes">
                <Textarea value={draft.notes} onChange={(event) => set("notes", event.target.value)} />
              </Field>
              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <CircleAlertIcon className="size-4 shrink-0" /> {error}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2Icon className="animate-spin" />}
                {busy ? "Saving…" : draft.id ? "Update rule" : "Add rule"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(toDelete)} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this rule?</DialogTitle>
            <DialogDescription>
              {toDelete?.category} will be removed and every stored fault is recalculated. Original comments are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Keep rule
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={onConfirmDelete}>
              {deleting && <Loader2Icon className="animate-spin" />}
              Remove rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
