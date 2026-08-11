"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import type { AmortizationRow } from "@/lib/calculations/loan";
import { scheduleTotals } from "@/lib/calculations/loan";

type Props = {
  schedule: AmortizationRow[];
  loanName: string;
};

function downloadCsv(schedule: AmortizationRow[], loanName: string) {
  const header = [
    "EMI #",
    "Date",
    "Opening Balance",
    "Principal",
    "Interest",
    "EMI",
    "Closing Balance",
  ];
  const lines = schedule.map((r) =>
    [
      r.emiNumber,
      r.date,
      r.openingBalance,
      r.principal,
      r.interest,
      r.emi,
      r.closingBalance,
    ].join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${loanName.replace(/\s+/g, "-").toLowerCase()}-amortization.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPrintable(schedule: AmortizationRow[], loanName: string) {
  const totals = scheduleTotals(schedule);
  const rows = schedule
    .map(
      (r) =>
        `${r.emiNumber}\t${r.date}\t${r.openingBalance}\t${r.principal}\t${r.interest}\t${r.emi}\t${r.closingBalance}`
    )
    .join("\n");
  const text = [
    `Amortization Schedule — ${loanName}`,
    `Total Principal: ${totals.totalPrincipal}`,
    `Total Interest: ${totals.totalInterest}`,
    `Total Payable: ${totals.totalPayable}`,
    "",
    "EMI#\tDate\tOpening\tPrincipal\tInterest\tEMI\tClosing",
    rows,
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${loanName.replace(/\s+/g, "-").toLowerCase()}-amortization-print.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AmortizationTable({ schedule, loanName }: Props) {
  const totals = scheduleTotals(schedule);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {schedule.length} EMIs · Interest{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatINR(totals.totalInterest)}
          </span>{" "}
          · Payable{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatINR(totals.totalPayable)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(schedule, loanName)}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadPrintable(schedule, loanName)}
          >
            <Download className="size-4" />
            PDF-friendly
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>

      <div
        id="amortization-print"
        className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      >
        <div className="max-h-[480px] overflow-auto print:max-h-none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>EMI #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">EMI</TableHead>
                <TableHead className="text-right">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((row) => (
                <TableRow key={row.emiNumber}>
                  <TableCell className="tabular-nums">{row.emiNumber}</TableCell>
                  <TableCell>{formatDisplayDate(row.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.openingBalance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.principal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.interest)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatINR(row.emi)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(row.closingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              #amortization-print, #amortization-print * { visibility: visible; }
              #amortization-print {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
          `,
        }}
      />
    </div>
  );
}
