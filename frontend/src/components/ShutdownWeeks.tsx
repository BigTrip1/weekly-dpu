import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarOffIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";

import { addShutdownWeek, getShutdownWeeks, removeShutdownWeek, type ShutdownWeek } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addDays, formatDay } from "@/lib/dates";

/** Weeks when production was shut. The Dashboard trend chart and the Analytics weekly chart leave them out. */
export function ShutdownWeeks() {
  const [weeks, setWeeks] = useState<ShutdownWeek[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState("");

  const load = useCallback(() => {
    getShutdownWeeks()
      .then((result) => setWeeks(result.weeks))
      .catch((reason: Error) => toast.error("Could not load the shutdown weeks", { description: reason.message }))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!date) return;
    setBusy(true);
    try {
      const added = await addShutdownWeek(date, reason);
      toast.success(`Week commencing ${formatDay(added.week)} will be left out`);
      setDate("");
      setReason("");
      load();
    } catch (failure) {
      toast.error("Could not add the week", { description: failure instanceof Error ? failure.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(week: string) {
    setRemoving(week);
    try {
      await removeShutdownWeek(week);
      toast.success(`Week commencing ${formatDay(week)} is back in the charts`);
      load();
    } catch (failure) {
      toast.error("Could not remove the week", { description: failure instanceof Error ? failure.message : undefined });
    } finally {
      setRemoving("");
    }
  }

  const years = [...new Set(weeks.map((item) => item.week.slice(0, 4)))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOffIcon className="size-5" aria-hidden="true" /> Shutdown weeks
        </CardTitle>
        <CardDescription>
          Weeks when production was shut, for example a bank holiday, Whitsun, summer, autumn or Christmas shutdown. The weekly trend charts leave these weeks out so a near-empty week does not drag the line to zero. Totals, panels and exports still count every fault. Add the next year's weeks here ahead of time. Pick any date inside the week and the Monday is stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="shutdown-date" className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              Any date in the week
            </label>
            <Input id="shutdown-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="w-44" />
          </div>
          <div className="grid min-w-[14rem] flex-1 gap-1.5">
            <label htmlFor="shutdown-reason" className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              Reason
            </label>
            <Input id="shutdown-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Summer shutdown" maxLength={80} />
          </div>
          <Button type="submit" disabled={busy || !date}>
            {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add week
          </Button>
        </form>

        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shutdown weeks. Every week is shown in the charts.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {years.map((year) => (
              <div key={year}>
                <h3 className="mb-1.5 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{year}</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {weeks
                    .filter((item) => item.week.startsWith(year))
                    .map((item) => (
                      <li key={item.week} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div>
                          <div className="font-semibold">W/C {formatDay(item.week)}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.reason} · to {formatDay(addDays(item.week, 6))}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={removing === item.week}
                          onClick={() => onRemove(item.week)}
                          aria-label={`Remove week commencing ${formatDay(item.week)}`}
                        >
                          {removing === item.week ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
