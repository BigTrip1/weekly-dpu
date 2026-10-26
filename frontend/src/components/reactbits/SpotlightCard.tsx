import { useRef, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Adapted from the React Bits SpotlightCard component (TypeScript and Tailwind variant).
type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
};

export default function SpotlightCard({ children, className, spotlightColor = "rgba(255, 205, 0, 0.16)" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      style={{ "--spot-color": spotlightColor } as React.CSSProperties}
      className={cn("group/spot relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-primary/60", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 50%), var(--spot-color), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
