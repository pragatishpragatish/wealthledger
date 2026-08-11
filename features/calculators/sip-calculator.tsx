"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR, formatPercent } from "@/utils/currency";
import {
  calculateLumpsumGrowth,
  calculateSip,
} from "@/lib/calculations/investment";
import { CalcField, CalcStat } from "@/features/calculators/calc-ui";

/**
 * One tool for lumpsum-only, SIP-only, or both — with optional annual step-up on SIP.
 * Leave monthly SIP at 0 for pure lumpsum; leave lumpsum at 0 for pure SIP.
 */
export function SipCalculator() {
  const [lumpsum, setLumpsum] = useState(0);
  const [monthly, setMonthly] = useState(5000);
  const [stepUp, setStepUp] = useState(0);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);

  const result = useMemo(() => {
    const yearsSafe = Math.max(0, years);
    const rateSafe = Math.max(0, rate);
    const sip = Math.max(0, monthly);
    const lump = Math.max(0, lumpsum);
    const step = Math.max(0, stepUp);

    if (sip <= 0 && lump <= 0) {
      return {
        corpus: 0,
        invested: 0,
        gains: 0,
        months: Math.round(yearsSafe * 12),
        finalMonthlySip: 0,
        mode: "empty" as const,
      };
    }

    if (sip <= 0) {
      const growth = calculateLumpsumGrowth({
        principal: lump,
        annualRatePercent: rateSafe,
        years: yearsSafe,
      });
      return {
        corpus: growth.futureValue,
        invested: growth.invested,
        gains: growth.gains,
        months: Math.round(yearsSafe * 12),
        finalMonthlySip: 0,
        mode: "lumpsum" as const,
      };
    }

    const sipResult = calculateSip({
      monthlyInvestment: sip,
      annualRatePercent: rateSafe,
      years: yearsSafe,
      lumpsum: lump,
      stepUpPercent: step,
    });

    return {
      ...sipResult,
      mode: (lump > 0 ? "both" : "sip") as "sip" | "both",
    };
  }, [lumpsum, monthly, stepUp, rate, years]);

  const modeLabel =
    result.mode === "lumpsum"
      ? "Lumpsum only"
      : result.mode === "sip"
        ? "SIP only"
        : result.mode === "both"
          ? "SIP + lumpsum"
          : "Enter an amount";

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Use lumpsum alone, SIP alone, or both. Set monthly SIP to 0 for a
        one-time investment; set lumpsum to 0 for SIP-only. Step-up applies
        only when SIP &gt; 0.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcField
          label="Lumpsum (₹)"
          hint="One-time amount at the start — use 0 if none"
        >
          <Input
            type="number"
            min={0}
            step={1000}
            value={lumpsum}
            onChange={(e) => setLumpsum(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField
          label="Monthly SIP (₹)"
          hint="Recurring investment — use 0 for lumpsum only"
        >
          <Input
            type="number"
            min={0}
            step={500}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField
          label="SIP step-up % / year"
          hint={
            monthly > 0
              ? "Increase SIP after every 12 months — use 0 for none"
              : "Enabled when monthly SIP is greater than 0"
          }
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={stepUp}
            disabled={monthly <= 0}
            onChange={(e) => setStepUp(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Expected return % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat
          label="Maturity value"
          value={formatINR(result.corpus)}
          accent="teal"
        />
        <CalcStat label="Total invested" value={formatINR(result.invested)} />
        <CalcStat
          label="Est. gains"
          value={formatINR(result.gains)}
          accent="positive"
        />
        <CalcStat
          label={
            monthly > 0 && stepUp > 0 ? "Final monthly SIP" : "Mode"
          }
          value={
            monthly > 0 && stepUp > 0
              ? formatINR(result.finalMonthlySip)
              : modeLabel
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Gain share of corpus:{" "}
        {result.corpus > 0
          ? formatPercent((result.gains / result.corpus) * 100, 1)
          : "0%"}
        . Returns are illustrative — markets vary.
      </p>
    </div>
  );
}
