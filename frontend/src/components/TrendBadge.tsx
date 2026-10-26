import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatShareChange, formatTrend, tone } from "@/format";

const toneVariant = { up: "up", down: "down", flat: "flat", na: "flat" } as const;

function ToneIcon({ value }: { value: number | null }) {
  const kind = tone(value);
  if (kind === "up") return <ArrowUpIcon aria-hidden="true" />;
  if (kind === "down") return <ArrowDownIcon aria-hidden="true" />;
  return <MinusIcon aria-hidden="true" />;
}

export function CountTrend({ value }: { value: number | null }) {
  return (
    <Badge variant={toneVariant[tone(value)]} className="min-w-[3.6rem] font-mono tabular-nums">
      {value == null ? null : <ToneIcon value={value} />}
      {formatTrend(value)}
    </Badge>
  );
}

export function ShareTrend({ value }: { value: number | null }) {
  return (
    <Badge variant={toneVariant[tone(value)]} className="min-w-[4.2rem] font-mono tabular-nums">
      {value == null ? null : <ToneIcon value={value} />}
      {formatShareChange(value)}
    </Badge>
  );
}
