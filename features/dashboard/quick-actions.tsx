"use client";

import Link from "next/link";
import {
  Plus,
  Wallet,
  TrendingUp,
  Landmark,
  LineChart,
  HandCoins,
} from "lucide-react";

const actions = [
  {
    label: "Add Expense",
    href: "/expenses?action=new",
    icon: Wallet,
    color: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  {
    label: "Add Income",
    href: "/income?action=new",
    icon: TrendingUp,
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  {
    label: "Add Account",
    href: "/accounts?action=new",
    icon: Landmark,
    color: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  },
  {
    label: "Add Investment",
    href: "/investments?action=new",
    icon: LineChart,
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  {
    label: "Add Loan",
    href: "/loans?action=new",
    icon: HandCoins,
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
];

export function QuickActions() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              prefetch={false}
              className="flex items-center gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-border/60 hover:bg-muted/50"
            >
              <span
                className={`flex size-9 items-center justify-center rounded-lg ${action.color}`}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium">{action.label}</span>
              <Plus className="ml-auto size-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
