"use client";

import {
  Wallet,
  Landmark,
  LineChart,
  Scale,
  CreditCard,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from "lucide-react";
import { StatCard, SavingsRateCard } from "@/features/dashboard/stat-cards";
import {
  CashFlowChart,
  IncomeExpenseChart,
  SpendingTrendChart,
  AllocationChart,
  NetWorthTrendChart,
} from "@/features/dashboard/lazy-charts";
import { UpcomingList } from "@/features/dashboard/upcoming-list";
import { QuickActions } from "@/features/dashboard/quick-actions";
import type { DashboardData } from "@/features/dashboard/queries";

export function DashboardView({ data }: { data: DashboardData }) {
  const { summary } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your financial overview in Indian Rupees
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          title="Net Worth"
          value={summary.netWorth}
          icon={Scale}
          accent="teal"
          delay={0}
        />
        <StatCard
          title="Total Cash"
          value={summary.totalCash}
          icon={Landmark}
          accent="default"
          delay={0.04}
        />
        <StatCard
          title="Investments"
          value={summary.investments}
          icon={LineChart}
          accent="positive"
          delay={0.08}
        />
        <StatCard
          title="Total Assets"
          value={summary.totalAssets}
          icon={Wallet}
          accent="default"
          delay={0.12}
        />
        <StatCard
          title="Total Liabilities"
          value={summary.totalLiabilities}
          icon={Scale}
          accent="negative"
          delay={0.16}
        />
        <StatCard
          title="Credit Card Outstanding"
          value={summary.creditCardOutstanding}
          icon={CreditCard}
          accent="amber"
          delay={0.2}
        />
        <StatCard
          title="Monthly Income"
          value={summary.monthlyIncome}
          icon={TrendingUp}
          accent="positive"
          delay={0.24}
        />
        <StatCard
          title="Monthly Expense"
          value={summary.monthlyExpense}
          icon={TrendingDown}
          accent="negative"
          delay={0.28}
        />
        <StatCard
          title="Monthly Savings"
          value={summary.monthlySavings}
          icon={PiggyBank}
          accent={summary.monthlySavings >= 0 ? "positive" : "negative"}
          delay={0.32}
        />
        <SavingsRateCard rate={summary.savingsRate} delay={0.36} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowChart data={data.cashFlow} />
        <IncomeExpenseChart data={data.incomeVsExpense} />
        <SpendingTrendChart data={data.spendingTrend} />
        <NetWorthTrendChart data={data.netWorthTrend} />
        <AllocationChart
          title="Investment Allocation"
          data={data.investmentAllocation}
        />
        <AllocationChart title="Loan Breakdown" data={data.loanBreakdown} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingList items={data.upcoming} />
        <QuickActions />
      </div>
    </div>
  );
}
