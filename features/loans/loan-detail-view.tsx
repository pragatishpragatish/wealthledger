"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { formatINR, formatINRCompact, formatPercent } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { LOAN_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LoanForm } from "@/features/loans/loan-form";
import { AmortizationTable } from "@/features/loans/amortization-table";
import { PrepaymentSimulator } from "@/features/loans/prepayment-simulator";
import { EmiCalculator } from "@/features/loans/emi-calculator";
import type { LoanDetailData } from "@/features/loans/queries";

const typeLabel = Object.fromEntries(
  LOAN_TYPES.map((t) => [t.value, t.label])
) as Record<string, string>;

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: "12px",
};

export function LoanDetailView({ data }: { data: LoanDetailData }) {
  const { loan, schedule, scheduleTotals, principalVsInterest, outstandingTrend, simulations, accounts } =
    data;
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/loans"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="size-4" />
          Loans
        </Link>
      </div>

      <PageHeader
        title={loan.name}
        description={`${loan.bank} · ${typeLabel[loan.loan_type] ?? loan.loan_type}`}
        action={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">
          {loan.interest_type === "flat" ? "Flat" : "Reducing"}
        </Badge>
        <Badge variant="outline">
          {formatPercent(loan.interest_rate)} p.a.
        </Badge>
        <Badge variant="outline">
          Started {formatDisplayDate(loan.start_date)}
        </Badge>
        <Badge variant="outline">
          {loan.emis_paid}/{loan.tenure_months} EMIs paid
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="amortization">Amortization</TabsTrigger>
          <TabsTrigger value="prepayment">Prepayment</TabsTrigger>
          <TabsTrigger value="calculator">EMI Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Outstanding"
              value={formatINR(loan.outstanding_principal)}
            />
            <Stat
              label="Principal paid"
              value={formatINR(loan.principal_paid)}
            />
            <Stat
              label="Interest paid"
              value={formatINR(loan.interest_paid)}
            />
            <Stat label="Monthly EMI" value={formatINR(loan.emi)} />
            <Stat
              label="Remaining tenure"
              value={`${loan.remaining_months} months`}
            />
            <Stat
              label="Remaining interest"
              value={formatINR(scheduleTotals.totalInterest)}
            />
            <Stat
              label="Remaining payable"
              value={formatINR(scheduleTotals.totalPayable)}
            />
            <Stat
              label="Total interest (lifetime)"
              value={formatINR(loan.total_interest)}
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Progress
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span>{loan.emis_paid} EMIs paid</span>
              <span className="tabular-nums font-medium">
                {formatPercent(loan.progress_percent)}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                style={{
                  width: `${Math.min(100, Math.max(loan.progress_percent, 1))}%`,
                }}
              />
            </div>
            {loan.notes && (
              <p className="mt-4 text-sm text-muted-foreground">{loan.notes}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="charts" className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Principal vs Interest
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={principalVsInterest}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {principalVsInterest.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatINR(Number(value ?? 0))}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Outstanding trend
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={outstandingTrend}>
                  <defs>
                    <linearGradient id="loanOutFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F766E" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0F766E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/50"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => formatINRCompact(v)}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    width={56}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatINR(Number(value ?? 0))}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Outstanding"
                    stroke="#0F766E"
                    fill="url(#loanOutFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="amortization" className="mt-4">
          <AmortizationTable schedule={schedule} loanName={loan.name} />
        </TabsContent>

        <TabsContent value="prepayment" className="mt-4">
          <PrepaymentSimulator loan={loan} simulations={simulations} />
        </TabsContent>

        <TabsContent value="calculator" className="mt-4">
          <EmiCalculator />
        </TabsContent>
      </Tabs>

      <LoanForm
        open={editOpen}
        onOpenChange={setEditOpen}
        loan={loan}
        accounts={accounts}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 font-heading text-xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
