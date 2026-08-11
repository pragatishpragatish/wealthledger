"use client";

import Link from "next/link";
import {
  CreditCard,
  HandCoins,
  CalendarClock,
  LineChart,
  Receipt,
} from "lucide-react";
import { formatINR } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import type { UpcomingItem } from "@/types";

const iconMap = {
  credit_card: CreditCard,
  emi: HandCoins,
  bill: Receipt,
  sip: LineChart,
  fd_maturity: CalendarClock,
};

export function UpcomingList({ items }: { items: UpcomingItem[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Upcoming
      </h3>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing due soon. You&apos;re all caught up.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = iconMap[item.type];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(item.dueDate)}
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatINR(item.amount)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
