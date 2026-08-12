import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontally scrollable table shell for narrow screens. */
export function TableScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm",
        className
      )}
    >
      <div className="-mx-px overflow-x-auto overscroll-x-contain">{children}</div>
    </div>
  );
}
