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
import { cn } from "@/lib/utils";
import type { InvestmentComputed } from "@/features/investments/summary";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentComputed | null;
};

function entryLabel(type: string) {
  if (type === "sell") return "Sell / redeem";
  if (type === "sip") return "SIP";
  return "Buy";
}

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
            {investment ? `${investment.name} · activity` : "Activity"}
          </DialogTitle>
          <DialogDescription>
            Buys and withdrawals for this holding, newest first.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No dated entries yet. Use “Buy more” or “Withdraw” to log activity.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto">
            {entries.map((entry) => {
              const isSell = entry.type === "sell";
              return (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-medium tabular-nums",
                        isSell
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {isSell ? "−" : "+"}
                      {formatINR(entry.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entryLabel(entry.type)} · {formatDisplayDate(entry.date)}
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
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
