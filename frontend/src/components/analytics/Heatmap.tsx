import { formatInt } from "@/format";

type Props = {
  areas: string[];
  defects: string[];
  cells: { area: string; defect: string; count: number }[];
  onCell: (area: string, defect: string) => void;
  onArea: (area: string) => void;
  onDefect: (defect: string) => void;
};

// Machine area against defect type. Colour depth follows the count. Recharts has no heatmap, so this is a grid.
export function Heatmap({ areas, defects, cells, onCell, onArea, onDefect }: Props) {
  const lookup = new Map(cells.map((cell) => [`${cell.area}||${cell.defect}`, cell.count]));
  const max = Math.max(1, ...cells.map((cell) => cell.count));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-36" />
            {defects.map((defect) => (
              <th key={defect} className="p-0 font-semibold">
                <button
                  type="button"
                  onClick={() => onDefect(defect)}
                  className="w-full cursor-pointer rounded px-1 py-1.5 text-center leading-tight text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  title={`Open every ${defect} fault`}
                >
                  {defect}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area}>
              <th className="p-0 text-left font-semibold">
                <button
                  type="button"
                  onClick={() => onArea(area)}
                  className="w-full cursor-pointer truncate rounded px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  title={`Open every ${area} fault`}
                >
                  {area}
                </button>
              </th>
              {defects.map((defect) => {
                const count = lookup.get(`${area}||${defect}`) ?? 0;
                const strength = count ? 10 + (count / max) * 75 : 0;
                return (
                  <td key={defect} className="p-0">
                    <button
                      type="button"
                      disabled={!count}
                      onClick={() => onCell(area, defect)}
                      title={`${area}, ${defect}: ${formatInt(count)}`}
                      className="grid h-9 w-full cursor-pointer place-items-center rounded font-mono text-[11px] font-semibold tabular-nums transition-[outline] outline-offset-0 hover:outline-2 hover:outline-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:text-muted-foreground/40"
                      style={{
                        backgroundColor: count ? `color-mix(in oklab, var(--primary) ${strength}%, transparent)` : "var(--muted)",
                        color: strength > 52 ? "#161616" : undefined,
                      }}
                    >
                      {count ? formatInt(count) : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
