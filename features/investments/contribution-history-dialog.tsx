"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import type { InvestmentComputed } from "@/features/investments/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentComputed | null;
};

export function ContributionHistoryDialog({
  open,
  onOpenChange,
  investment,
}: Props) {
  const entries = investment?.contributions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {investment ? `${investment.name} · entries` : "Entries"}
          </DialogTitle>
          <DialogDescription>
            Every purchase logged against this holding, newest first.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No dated entries yet. Use “Add money” to log a top-up.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">
                    {formatINR(entry.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDate(entry.date)}
                    {entry.units > 0
                      ? ` · ${entry.units} units`
                      : ""}
                    {entry.price > 0
                      ? ` @ ${formatINR(entry.price, { precise: true })}`
                      : ""}
                  </p>
                  {entry.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
