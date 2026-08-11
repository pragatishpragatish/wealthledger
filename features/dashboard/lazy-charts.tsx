"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { AllocationPoint, ChartPoint } from "@/types";

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

function wrap(
  loader: () => Promise<{ default: React.ComponentType<any> }>
) {
  return dynamic(loader, {
    ssr: false,
    loading: () => <ChartSkeleton />,
  });
}

export const CashFlowChart = wrap(() =>
  import("@/features/dashboard/charts").then((m) => ({
    default: m.CashFlowChart,
  }))
) as React.ComponentType<{ data: ChartPoint[] }>;

export const IncomeExpenseChart = wrap(() =>
  import("@/features/dashboard/charts").then((m) => ({
    default: m.IncomeExpenseChart,
  }))
) as React.ComponentType<{ data: ChartPoint[] }>;

export const SpendingTrendChart = wrap(() =>
  import("@/features/dashboard/charts").then((m) => ({
    default: m.SpendingTrendChart,
  }))
) as React.ComponentType<{ data: ChartPoint[] }>;

export const AllocationChart = wrap(() =>
  import("@/features/dashboard/charts").then((m) => ({
    default: m.AllocationChart,
  }))
) as React.ComponentType<{ title: string; data: AllocationPoint[] }>;

export const NetWorthTrendChart = wrap(() =>
  import("@/features/dashboard/charts").then((m) => ({
    default: m.NetWorthTrendChart,
  }))
) as React.ComponentType<{ data: ChartPoint[] }>;
