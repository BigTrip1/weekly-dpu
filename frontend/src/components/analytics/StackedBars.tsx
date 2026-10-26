import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import type { StackRow } from "@/api";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { departmentColor, departmentKey } from "@/lib/departments";

type Props = {
  rows: StackRow[];
  departments: string[];
  onSelect: (label: string, department: string) => void;
  labelWidth?: number;
};

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

// Horizontal bars, one per label, split into a segment per department. A segment opens its records.
export function StackedBars({ rows, departments, onSelect, labelWidth = 130 }: Props) {
  const data = useMemo(
    () =>
      rows.map((row) => ({
        label: row.label,
        ...Object.fromEntries(departments.map((name) => [departmentKey(name), row.departments[name] ?? 0])),
      })),
    [rows, departments],
  );
  const config: ChartConfig = Object.fromEntries(departments.map((name) => [departmentKey(name), { label: name, color: departmentColor(name) }]));
  const used = departments.filter((name) => rows.some((row) => (row.departments[name] ?? 0) > 0));

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rows.length * 28 + 36 }}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: string) => clip(value, Math.floor(labelWidth / 6.2))}
          />
          <RTooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={(props) => (
              <ChartTooltipContent
                active={props.active}
                label={props.label}
                payload={(props.payload as never[] | undefined)?.filter((item: { value?: number }) => Number(item.value) > 0)}
              />
            )}
          />
          {departments.map((name) => (
            <Bar
              key={name}
              dataKey={departmentKey(name)}
              name={name}
              stackId="dept"
              fill={departmentColor(name)}
              barSize={16}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(entry) => {
                const label = (entry as { label?: string }).label;
                if (label) onSelect(label, name);
              }}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Department colours">
        {used.map((name) => (
          <li key={name} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: departmentColor(name) }} aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
