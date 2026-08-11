function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type SipResult = {
  corpus: number;
  invested: number;
  gains: number;
  months: number;
  finalMonthlySip: number;
};

/**
 * SIP corpus with optional starting lumpsum and annual step-up.
 * Month-end contribution model; step-up applied after every 12 installments.
 */
export function calculateSip(opts: {
  monthlyInvestment: number;
  annualRatePercent: number;
  years: number;
  lumpsum?: number;
  stepUpPercent?: number;
}): SipResult {
  const months = Math.max(0, Math.round(opts.years * 12));
  const r = opts.annualRatePercent / 12 / 100;
  const stepUp = Math.max(0, opts.stepUpPercent ?? 0) / 100;

  let corpus = Math.max(0, opts.lumpsum ?? 0);
  let invested = corpus;
  let sip = Math.max(0, opts.monthlyInvestment);

  for (let m = 1; m <= months; m++) {
    corpus = corpus * (1 + r) + sip;
    invested += sip;
    if (stepUp > 0 && m % 12 === 0 && m < months) {
      sip = sip * (1 + stepUp);
    }
  }

  return {
    corpus: round2(corpus),
    invested: round2(invested),
    gains: round2(corpus - invested),
    months,
    finalMonthlySip: round2(sip),
  };
}

/**
 * Monthly SIP needed to reach a goal (optional lumpsum + step-up via binary search).
 */
export function requiredMonthlySip(opts: {
  goalAmount: number;
  annualRatePercent: number;
  years: number;
  lumpsum?: number;
  stepUpPercent?: number;
}): number {
  const goal = Math.max(0, opts.goalAmount);
  if (goal <= 0 || opts.years <= 0) return 0;

  const lumpsum = Math.max(0, opts.lumpsum ?? 0);
  const stepUp = Math.max(0, opts.stepUpPercent ?? 0);

  // Without step-up, closed form after removing lumpsum growth
  if (stepUp === 0) {
    const months = Math.round(opts.years * 12);
    const r = opts.annualRatePercent / 12 / 100;
    const lumpsumFv = lumpsum * Math.pow(1 + r, months);
    const remaining = Math.max(0, goal - lumpsumFv);
    if (remaining <= 0) return 0;
    if (r === 0) return round2(remaining / months);
    const pmt =
      (remaining * r) / (Math.pow(1 + r, months) - 1);
    return round2(pmt);
  }

  let lo = 0;
  let hi = goal;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { corpus } = calculateSip({
      monthlyInvestment: mid,
      annualRatePercent: opts.annualRatePercent,
      years: opts.years,
      lumpsum,
      stepUpPercent: stepUp,
    });
    if (corpus < goal) lo = mid;
    else hi = mid;
  }
  return round2(hi);
}

/** One-time lumpsum compounded monthly. */
export function calculateLumpsumGrowth(opts: {
  principal: number;
  annualRatePercent: number;
  years: number;
}): { futureValue: number; invested: number; gains: number } {
  const months = Math.max(0, Math.round(opts.years * 12));
  const r = opts.annualRatePercent / 12 / 100;
  const principal = Math.max(0, opts.principal);
  const futureValue = round2(principal * Math.pow(1 + r, months));
  return {
    futureValue,
    invested: round2(principal),
    gains: round2(futureValue - principal),
  };
}

/** Indian FD-style compounding (default quarterly). */
export function calculateFd(opts: {
  principal: number;
  annualRatePercent: number;
  years: number;
  compoundsPerYear?: 1 | 2 | 4 | 12;
}): { maturity: number; invested: number; interest: number } {
  const n = opts.compoundsPerYear ?? 4;
  const principal = Math.max(0, opts.principal);
  const t = Math.max(0, opts.years);
  const rate = opts.annualRatePercent / 100;
  const maturity = round2(principal * Math.pow(1 + rate / n, n * t));
  return {
    maturity,
    invested: round2(principal),
    interest: round2(maturity - principal),
  };
}

/** Recurring deposit — monthly deposit, monthly compounding approximation. */
export function calculateRd(opts: {
  monthlyDeposit: number;
  annualRatePercent: number;
  years: number;
}): SipResult {
  return calculateSip({
    monthlyInvestment: opts.monthlyDeposit,
    annualRatePercent: opts.annualRatePercent,
    years: opts.years,
    lumpsum: 0,
    stepUpPercent: 0,
  });
}

export function calculateInflation(opts: {
  amount: number;
  annualInflationPercent: number;
  years: number;
}): {
  futureCost: number;
  presentValue: number;
  erodedPurchasingPower: number;
} {
  const amount = Math.max(0, opts.amount);
  const years = Math.max(0, opts.years);
  const i = opts.annualInflationPercent / 100;
  const futureCost = round2(amount * Math.pow(1 + i, years));
  const presentValue = round2(amount / Math.pow(1 + i, years));
  return {
    futureCost,
    presentValue,
    erodedPurchasingPower: round2(amount - presentValue),
  };
}

/** CAGR between two values over years. */
export function calculateCagr(opts: {
  startValue: number;
  endValue: number;
  years: number;
}): number {
  const start = opts.startValue;
  const end = opts.endValue;
  const years = opts.years;
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return round2((Math.pow(end / start, 1 / years) - 1) * 100);
}
