import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function ChartCard({ title, description, actions, loading, empty, emptyText = "No faults match these filters.", className, contentClassName, children }: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-3", contentClassName)}>
        {loading && empty ? (
          <Skeleton className="h-60 w-full" />
        ) : empty ? (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          <div className={cn(loading && "opacity-60 transition-opacity")}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
