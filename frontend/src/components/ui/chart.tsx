import * as React from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactElement;
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

export function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used inside ChartContainer");
  return context;
}

function ChartContainer({ config, className, children, style, ...props }: ChartContainerProps) {
  const vars = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]));
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        style={{ ...vars, ...style } as React.CSSProperties}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

type TooltipPayload = { name?: string; dataKey?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> };

function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  valueFormatter?: (value: number | string) => string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div className="grid min-w-[8rem] gap-1.5 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl">
      {label != null && label !== "" && <div className="font-semibold">{label}</div>}
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.name ?? index);
        const entry = config[key] ?? config[String(item.name)];
        const swatch = item.color ?? entry?.color ?? "var(--primary)";
        const value = item.value ?? 0;
        return (
          <div key={`${key}-${index}`} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />
            <span className="text-muted-foreground">{item.name ?? entry?.label ?? key}</span>
            <span className="ml-auto pl-3 font-mono font-semibold tabular-nums">
              {valueFormatter ? valueFormatter(value) : typeof value === "number" ? value.toLocaleString("en-GB") : value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltipContent };
