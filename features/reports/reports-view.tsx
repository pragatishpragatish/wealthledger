"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  Printer,
  Save,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { formatINR, formatPercent } from "@/utils/currency";
import { listIndianFYOptions } from "@/utils/date";
import { downloadReportFile } from "@/features/reports/export";
import { saveReport } from "@/features/reports/actions";
import type {
  FinancialReport,
  ReportPeriodType,
  ReportSection,
} from "@/features/reports/types";

const PERIOD_OPTIONS: { value: ReportPeriodType; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Calendar year" },
  { value: "financial_year", label: "Indian FY (Apr–Mar)" },
];

const CHART_COLORS = [
  "#0F766E",
  "#2563EB",
  "#CA8A04",
  "#DB2777",
  "#7C3AED",
  "#EA580C",
];

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function SectionTable({ section }: { section: ReportSection }) {
  if (section.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No data for this period.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="hidden sm:table-cell">Notes</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {section.rows.map((row) => (
          <TableRow key={`${section.title}-${row.label}`}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {row.meta ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatINR(row.amount)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="hidden sm:table-cell" />
          <TableCell className="text-right font-semibold tabular-nums">
            {formatINR(section.total)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function ReportBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-section space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm print:break-inside-avoid print:border print:shadow-none">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ReportsView({ report }: { report: FinancialReport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i);
  }, []);

  const fyOptions = useMemo(() => listIndianFYOptions(6), []);

  const cashFlowChart = useMemo(
    () => [
      { name: "Income", value: report.cashFlow.income },
      { name: "Expense", value: report.cashFlow.expense },
      { name: "Net", value: report.cashFlow.net },
    ],
    [report.cashFlow]
  );

  const expensePie = useMemo(
    () =>
      report.expense.rows.slice(0, 6).map((r, i) => ({
        name: r.label,
        value: r.amount,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [report.expense.rows]
  );

  function navigate(next: {
    periodType?: ReportPeriodType;
    year?: number;
    month?: number | null;
  }) {
    const periodType = next.periodType ?? report.periodType;
    let year = next.year ?? report.year;

    // When switching into Indian FY, keep a sensible FY start year
    if (
      next.periodType === "financial_year" &&
      report.periodType !== "financial_year" &&
      next.year === undefined
    ) {
      const match = fyOptions.find((o) => o.startYear === report.year);
      year = match?.startYear ?? fyOptions[0]?.startYear ?? report.year;
    }

    const month =
      periodType === "monthly"
        ? (next.month !== undefined ? next.month : report.month) ??
          new Date().getMonth() + 1
        : null;

    const params = new URLSearchParams();
    params.set("period", periodType);
    params.set("year", String(year));
    if (month != null) params.set("month", String(month));
    router.push(`/reports?${params.toString()}`);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveReport(report);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Report saved");
    });
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Monthly, calendar-year, and Indian financial year (Apr–Mar) summaries for tax filing."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => downloadReportFile(report, "csv")}
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadReportFile(report, "xls")}
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" />
                PDF / Print
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                <Save className="size-4" />
                Save
              </Button>
            </div>
          }
        />
      </div>

      <div className="hidden print:block">
        <h1 className="font-heading text-2xl font-semibold">
          WealthLedger · {report.label}
        </h1>
        <p className="text-sm text-muted-foreground">
          {report.periodStart} → {report.periodEnd}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Period</p>
          <Select
            value={report.periodType}
            onValueChange={(v) => {
              if (
                v === "monthly" ||
                v === "yearly" ||
                v === "financial_year"
              ) {
                navigate({ periodType: v });
              }
            }}
            items={Object.fromEntries(
              PERIOD_OPTIONS.map((o) => [o.value, o.label])
            )}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {report.periodType === "financial_year" ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Financial year
            </p>
            <Select
              value={String(report.year)}
              onValueChange={(v) => {
                if (v != null) navigate({ year: Number(v) });
              }}
              items={Object.fromEntries(
                fyOptions.map((o) => [String(o.startYear), o.label])
              )}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyOptions.map((o) => (
                  <SelectItem key={o.startYear} value={String(o.startYear)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {report.periodType === "yearly" ? "Calendar year" : "Year"}
            </p>
            <Select
              value={String(report.year)}
              onValueChange={(v) => {
                if (v != null) navigate({ year: Number(v) });
              }}
              items={Object.fromEntries(
                years.map((y) => [String(y), String(y)])
              )}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {report.periodType === "monthly" && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Month</p>
            <Select
              value={String(report.month ?? new Date().getMonth() + 1)}
              onValueChange={(v) => {
                if (v != null) navigate({ month: Number(v) });
              }}
              items={Object.fromEntries(
                MONTHS.map((m) => [m.value, m.label])
              )}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {report.periodType === "financial_year" && (
          <p className="pb-2 text-xs text-muted-foreground">
            Indian tax year: 1 Apr → 31 Mar · useful for ITR filing
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        {[
          { label: "Income", value: report.cashFlow.income },
          { label: "Expense", value: report.cashFlow.expense },
          { label: "Net cash flow", value: report.cashFlow.net },
          { label: "Net worth", value: report.netWorth.netWorth },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm print:shadow-none"
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {stat.label}
            </p>
            <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
              {formatINR(stat.value)}
            </p>
          </div>
        ))}
      </div>

      <ReportBlock title="Cash Flow">
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span>
            Savings rate:{" "}
            <strong>{formatPercent(report.cashFlow.savingsRate)}</strong>
          </span>
          <span className="text-muted-foreground">
            {report.periodStart} → {report.periodEnd}
          </span>
        </div>
        <div className="h-56 w-full print:hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlowChart}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={56} />
              <ChartTooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {cashFlowChart.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Income</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatINR(report.cashFlow.income)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Expense</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatINR(report.cashFlow.expense)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold">Net</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatINR(report.cashFlow.net)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ReportBlock>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportBlock title="Income">
          <SectionTable section={report.income} />
        </ReportBlock>
        <ReportBlock title="Expense">
          {expensePie.length > 0 && (
            <div className="mb-4 h-48 print:hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {expensePie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <SectionTable section={report.expense} />
        </ReportBlock>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportBlock title="Investment">
          <SectionTable section={report.investment} />
        </ReportBlock>
        <ReportBlock title="Loan">
          <SectionTable section={report.loan} />
        </ReportBlock>
      </div>

      <ReportBlock title="Budget">
        <SectionTable section={report.budget} />
      </ReportBlock>

      <ReportBlock title="Net Worth">
        <Table>
          <TableBody>
            {(
              [
                ["Cash", report.netWorth.totalCash],
                ["Investments", report.netWorth.totalInvestments],
                ["Total assets", report.netWorth.totalAssets],
                ["Credit cards", report.netWorth.creditCardOutstanding],
                ["Loans", report.netWorth.loanOutstanding],
                ["Total liabilities", report.netWorth.totalLiabilities],
                ["Net worth", report.netWorth.netWorth],
              ] as const
            ).map(([label, value]) => (
              <TableRow key={label}>
                <TableCell
                  className={
                    label === "Net worth" ? "font-semibold" : undefined
                  }
                >
                  {label}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${label === "Net worth" ? "font-semibold" : ""}`}
                >
                  {formatINR(value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportBlock>
    </div>
  );
}
