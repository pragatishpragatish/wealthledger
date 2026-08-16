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

export type SwpResult = {
  remainingCorpus: number;
  totalWithdrawn: number;
  interestEarned: number;
  monthsLasted: number;
  depleted: boolean;
};

/**
 * Systematic Withdrawal Plan — monthly withdrawal at month-start,
 * then monthly compounding on the balance.
 */
export function calculateSwp(opts: {
  corpus: number;
  monthlyWithdrawal: number;
  annualRatePercent: number;
  years: number;
}): SwpResult {
  const months = Math.max(0, Math.round(opts.years * 12));
  const r = opts.annualRatePercent / 12 / 100;
  const withdrawal = Math.max(0, opts.monthlyWithdrawal);
  let balance = Math.max(0, opts.corpus);
  let totalWithdrawn = 0;
  let monthsLasted = 0;

  for (let m = 1; m <= months; m++) {
    if (balance <= 0) break;
    const take = Math.min(withdrawal, balance);
    balance -= take;
    totalWithdrawn += take;
    monthsLasted = m;
    if (balance <= 0) {
      const withdrawn = round2(totalWithdrawn);
      return {
        remainingCorpus: 0,
        totalWithdrawn: withdrawn,
        interestEarned: round2(withdrawn - opts.corpus),
        monthsLasted,
        depleted: true,
      };
    }
    balance = balance * (1 + r);
  }

  const remaining = round2(balance);
  const withdrawn = round2(totalWithdrawn);
  return {
    remainingCorpus: remaining,
    totalWithdrawn: withdrawn,
    interestEarned: round2(remaining + withdrawn - opts.corpus),
    monthsLasted,
    depleted: false,
  };
}

/** Months until SWP corpus is exhausted (capped for safety). */
export function swpMonthsUntilDepleted(opts: {
  corpus: number;
  monthlyWithdrawal: number;
  annualRatePercent: number;
  maxMonths?: number;
}): number | null {
  const maxMonths = opts.maxMonths ?? 1200;
  const r = opts.annualRatePercent / 12 / 100;
  const withdrawal = Math.max(0, opts.monthlyWithdrawal);
  let balance = Math.max(0, opts.corpus);
  if (withdrawal <= 0 || balance <= 0) return null;

  for (let m = 1; m <= maxMonths; m++) {
    const take = Math.min(withdrawal, balance);
    balance -= take;
    if (balance <= 0) return m;
    balance = balance * (1 + r);
  }
  return null;
}

/**
 * Max constant monthly withdrawal so corpus lasts exactly `years`
 * (binary search on simulate).
 */
export function maxSustainableWithdrawal(opts: {
  corpus: number;
  annualRatePercent: number;
  years: number;
}): number {
  const corpus = Math.max(0, opts.corpus);
  const months = Math.max(0, Math.round(opts.years * 12));
  if (corpus <= 0 || months <= 0) return 0;

  let lo = 0;
  let hi = corpus;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { remainingCorpus, depleted } = calculateSwp({
      corpus,
      monthlyWithdrawal: mid,
      annualRatePercent: opts.annualRatePercent,
      years: opts.years,
    });
    if (depleted || remainingCorpus < 1) hi = mid;
    else lo = mid;
  }
  return round2(lo);
}

/** Lumpsum needed today to reach a future goal. */
export function requiredLumpsum(opts: {
  goalAmount: number;
  annualRatePercent: number;
  years: number;
}): number {
  const goal = Math.max(0, opts.goalAmount);
  const years = Math.max(0, opts.years);
  if (goal <= 0 || years <= 0) return 0;
  const months = Math.round(years * 12);
  const r = opts.annualRatePercent / 12 / 100;
  if (r === 0) return round2(goal);
  return round2(goal / Math.pow(1 + r, months));
}

/**
 * PPF-style yearly deposits with annual compounding
 * (simplified — deposits earn for the full year).
 */
export function calculatePpf(opts: {
  annualContribution: number;
  annualRatePercent: number;
  years?: number;
}): { maturity: number; invested: number; interest: number } {
  const years = Math.max(0, Math.round(opts.years ?? 15));
  const rate = opts.annualRatePercent / 100;
  const deposit = Math.max(0, opts.annualContribution);
  let balance = 0;
  let invested = 0;

  for (let y = 1; y <= years; y++) {
    balance += deposit;
    invested += deposit;
    balance = balance * (1 + rate);
  }

  return {
    maturity: round2(balance),
    invested: round2(invested),
    interest: round2(balance - invested),
  };
}

export type RetirementCorpusResult = {
  expenseAtRetirement: number;
  corpusNeeded: number;
  existingAtRetirement: number;
  gap: number;
  monthlySipNeeded: number;
};

/**
 * Corpus needed at retirement from today's expenses,
 * then SIP to close the gap after growing any existing corpus.
 */
export function calculateRetirementCorpus(opts: {
  monthlyExpenseToday: number;
  yearsToRetirement: number;
  inflationPercent: number;
  accumulationReturnPercent: number;
  retirementReturnPercent: number;
  yearsInRetirement: number;
  existingCorpus?: number;
}): RetirementCorpusResult {
  const expenseToday = Math.max(0, opts.monthlyExpenseToday);
  const yearsTo = Math.max(0, opts.yearsToRetirement);
  const inflation = opts.inflationPercent / 100;
  const yearsRetire = Math.max(0, opts.yearsInRetirement);
  const existing = Math.max(0, opts.existingCorpus ?? 0);

  const expenseAtRetirement = round2(
    expenseToday * Math.pow(1 + inflation, yearsTo)
  );

  let corpusNeeded = 0;
  if (expenseAtRetirement > 0 && yearsRetire > 0) {
    let lo = 0;
    let hi = expenseAtRetirement * yearsRetire * 12 * 4;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const maxW = maxSustainableWithdrawal({
        corpus: mid,
        annualRatePercent: opts.retirementReturnPercent,
        years: yearsRetire,
      });
      if (maxW < expenseAtRetirement) lo = mid;
      else hi = mid;
    }
    corpusNeeded = round2(hi);
  }

  const existingAtRetirement =
    yearsTo > 0
      ? calculateLumpsumGrowth({
          principal: existing,
          annualRatePercent: opts.accumulationReturnPercent,
          years: yearsTo,
        }).futureValue
      : round2(existing);

  const gap = Math.max(0, corpusNeeded - existingAtRetirement);
  const monthlySipNeeded =
    yearsTo > 0
      ? requiredMonthlySip({
          goalAmount: gap,
          annualRatePercent: opts.accumulationReturnPercent,
          years: yearsTo,
        })
      : 0;

  return {
    expenseAtRetirement,
    corpusNeeded,
    existingAtRetirement,
    gap,
    monthlySipNeeded,
  };
}
