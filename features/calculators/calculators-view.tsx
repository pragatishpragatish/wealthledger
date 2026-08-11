"use client";

import { useState } from "react";
import {
  Calculator,
  Landmark,
  LineChart,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { SipCalculator } from "@/features/calculators/sip-calculator";
import { GoalSipCalculator } from "@/features/calculators/goal-sip-calculator";
import {
  CagrCalculator,
  FdCalculator,
  InflationCalculator,
  RdCalculator,
} from "@/features/calculators/investment-calculators";
import { LoanCalculatorsPanel } from "@/features/calculators/loan-calculators";

const TOOLS = [
  {
    id: "sip",
    label: "SIP / Lumpsum",
    description: "SIP, lumpsum, or both — optional step-up",
    icon: TrendingUp,
    group: "Invest",
  },
  {
    id: "goal",
    label: "Goal SIP",
    description: "SIP needed for a target corpus",
    icon: Target,
    group: "Invest",
  },
  {
    id: "fd",
    label: "FD",
    description: "Fixed deposit maturity",
    icon: PiggyBank,
    group: "Invest",
  },
  {
    id: "rd",
    label: "RD",
    description: "Recurring deposit",
    icon: PiggyBank,
    group: "Invest",
  },
  {
    id: "loan",
    label: "Loan / EMI",
    description: "EMI, affordability, lumpsum payoff",
    icon: Landmark,
    group: "Borrow",
  },
  {
    id: "inflation",
    label: "Inflation",
    description: "Future cost & purchasing power",
    icon: LineChart,
    group: "Plan",
  },
  {
    id: "cagr",
    label: "CAGR",
    description: "Annualised return between two values",
    icon: Calculator,
    group: "Plan",
  },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

export function CalculatorsView() {
  const [active, setActive] = useState<ToolId>("sip");
  const activeMeta = TOOLS.find((t) => t.id === active)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calculators"
        description="Plan SIPs, loans, deposits and goals — numbers stay on your device."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-4">
          {(["Invest", "Borrow", "Plan"] as const).map((group) => (
            <div key={group}>
              <p className="mb-2 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group}
              </p>
              <ul className="space-y-1">
                {TOOLS.filter((t) => t.group === group).map((tool) => {
                  const Icon = tool.icon;
                  const selected = active === tool.id;
                  return (
                    <li key={tool.id}>
                      <button
                        type="button"
                        onClick={() => setActive(tool.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "bg-teal-500/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0" />
                        <span>
                          <span className="block text-sm font-medium">
                            {tool.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] opacity-80">
                            {tool.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-border/50 pb-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <activeMeta.icon className="size-5" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-semibold">
                {activeMeta.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {activeMeta.description}
              </p>
            </div>
          </div>

          {active === "sip" && <SipCalculator />}
          {active === "goal" && <GoalSipCalculator />}
          {active === "fd" && <FdCalculator />}
          {active === "rd" && <RdCalculator />}
          {active === "loan" && <LoanCalculatorsPanel />}
          {active === "inflation" && <InflationCalculator />}
          {active === "cagr" && <CagrCalculator />}
        </section>
      </div>
    </div>
  );
}
