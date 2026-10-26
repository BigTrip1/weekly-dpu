import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  total?: number;
  className?: string;
};

function Pagination({ page, pageCount, onPageChange, total, className }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className={className ?? "flex items-center justify-between gap-3 text-sm text-muted-foreground"}>
      <span>{total != null ? `${total.toLocaleString("en-GB")} records` : ""}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon /> Previous
        </Button>
        <span className="tabular-nums">
          Page {page} of {Math.max(pageCount, 1)}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}

export { Pagination };
