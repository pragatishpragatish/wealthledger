import type { FinancialReport, ReportSection } from "@/features/reports/types";

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sectionToCsv(section: ReportSection): string {
  const lines = [
    `${escapeCsvCell(section.title)},Amount,Notes`,
    ...section.rows.map(
      (r) =>
        `${escapeCsvCell(r.label)},${r.amount},${escapeCsvCell(r.meta ?? "")}`
    ),
    `${escapeCsvCell("Total")},${section.total},`,
  ];
  return lines.join("\n");
}

export function reportToCsv(report: FinancialReport): string {
  const blocks: string[] = [
    `WealthLedger Report,${escapeCsvCell(report.label)}`,
    `Period,${report.periodStart},${report.periodEnd}`,
    "",
    "Cash Flow,Amount",
    `Income,${report.cashFlow.income}`,
    `Expense,${report.cashFlow.expense}`,
    `Net,${report.cashFlow.net}`,
    `Savings Rate %,${report.cashFlow.savingsRate.toFixed(1)}`,
    "",
    sectionToCsv(report.income),
    "",
    sectionToCsv(report.expense),
    "",
    sectionToCsv(report.investment),
    "",
    sectionToCsv(report.loan),
    "",
    sectionToCsv(report.budget),
    "",
    "Net Worth,Amount",
    `Cash,${report.netWorth.totalCash}`,
    `Investments,${report.netWorth.totalInvestments}`,
    `Total Assets,${report.netWorth.totalAssets}`,
    `Credit Cards,${report.netWorth.creditCardOutstanding}`,
    `Loans,${report.netWorth.loanOutstanding}`,
    `Total Liabilities,${report.netWorth.totalLiabilities}`,
    `Net Worth,${report.netWorth.netWorth}`,
  ];
  return blocks.join("\n");
}

export function downloadReportFile(
  report: FinancialReport,
  format: "csv" | "xls"
): void {
  const csv = reportToCsv(report);
  const mime =
    format === "xls"
      ? "application/vnd.ms-excel;charset=utf-8"
      : "text/csv;charset=utf-8";
  const ext = format === "xls" ? "xls" : "csv";
  const blob = new Blob(["\uFEFF" + csv], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = report.label.replace(/\s+/g, "-").toLowerCase();
  a.href = url;
  a.download = `wealthledger-report-${slug}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
