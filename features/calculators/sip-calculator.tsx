"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR, formatPercent } from "@/utils/currency";
import {
  calculateLumpsumGrowth,
  calculateSip,
} from "@/lib/calculations/investment";
import {
  CalcField,
  CalcMoneyInput,
  CalcStat,
  parseAmount,
} from "@/features/calculators/calc-ui";

/**
 * One tool for lumpsum-only, SIP-only, or both — with optional annual step-up on SIP.
 * Blank optional fields count as zero.
 */
export function SipCalculator() {
  const [lumpsum, setLumpsum] = useState("");
  const [monthly, setMonthly] = useState("");
  const [stepUp, setStepUp] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const lump = parseAmount(lumpsum);
  const sip = parseAmount(monthly);
  const step = parseAmount(stepUp);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);

  const result = useMemo(() => {
    if (sip <= 0 && lump <= 0) {
      return {
        corpus: 0,
        invested: 0,
        gains: 0,
        months: Math.round(yearsN * 12),
        finalMonthlySip: 0,
        mode: "empty" as const,
      };
    }

    if (sip <= 0) {
      const growth = calculateLumpsumGrowth({
        principal: lump,
        annualRatePercent: rateN,
        years: yearsN,
      });
      return {
        corpus: growth.futureValue,
        invested: growth.invested,
        gains: growth.gains,
        months: Math.round(yearsN * 12),
        finalMonthlySip: 0,
        mode: "lumpsum" as const,
      };
    }

    const sipResult = calculateSip({
      monthlyInvestment: sip,
      annualRatePercent: rateN,
      years: yearsN,
      lumpsum: lump,
      stepUpPercent: step,
    });

    return {
      ...sipResult,
      mode: (lump > 0 ? "both" : "sip") as "sip" | "both",
    };
  }, [lump, sip, step, rateN, yearsN]);

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
        Fill lumpsum, monthly SIP, or both. Leave a field blank to skip it.
        Step-up only applies when a monthly SIP is entered.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcMoneyInput
          label="Lumpsum (₹)"
          hint="One-time amount at the start — leave blank if none"
          placeholder="e.g. 50000"
          step={1000}
          value={lumpsum}
          onChange={setLumpsum}
        />
        <CalcMoneyInput
          label="Monthly SIP (₹)"
          hint="Recurring investment — leave blank for lumpsum only"
          placeholder="e.g. 5000"
          step={500}
          value={monthly}
          onChange={setMonthly}
        />
        <CalcField
          label="SIP step-up % / year"
          hint={
            sip > 0
              ? "Increase SIP after every 12 months — leave blank for none"
              : "Available once you enter a monthly SIP"
          }
        >
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 10"
            value={stepUp}
            disabled={sip <= 0}
            onChange={(e) => setStepUp(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Expected return % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 12"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 10"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
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
          label={sip > 0 && step > 0 ? "Final monthly SIP" : "Mode"}
          value={
            sip > 0 && step > 0
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
