import {
  calculateSip,
  requiredMonthlySip,
  calculateLumpsumGrowth,
  calculateFd,
  calculateCagr,
} from "../lib/calculations/investment";
import { calculateEMI } from "../lib/calculations/loan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Plain SIP 12% for 1 year ₹1000/mo ≈ FV of annuity
const sip = calculateSip({
  monthlyInvestment: 1000,
  annualRatePercent: 12,
  years: 1,
});
assert(sip.invested === 12000, `invested ${sip.invested}`);
assert(sip.corpus > 12000, `corpus ${sip.corpus}`);

const withLump = calculateSip({
  monthlyInvestment: 1000,
  annualRatePercent: 12,
  years: 1,
  lumpsum: 10000,
});
assert(withLump.corpus > sip.corpus, "lumpsum should grow corpus");

const stepped = calculateSip({
  monthlyInvestment: 1000,
  annualRatePercent: 12,
  years: 2,
  stepUpPercent: 10,
});
assert(stepped.finalMonthlySip > 1000, "step-up should raise SIP");

const needed = requiredMonthlySip({
  goalAmount: 100000,
  annualRatePercent: 12,
  years: 5,
});
assert(needed > 0, "required sip");

const lump = calculateLumpsumGrowth({
  principal: 100000,
  annualRatePercent: 10,
  years: 1,
});
assert(lump.futureValue > 100000, "lumpsum growth");

const fd = calculateFd({
  principal: 100000,
  annualRatePercent: 7,
  years: 1,
  compoundsPerYear: 4,
});
assert(fd.maturity > 100000, "fd maturity");

assert(calculateCagr({ startValue: 100, endValue: 121, years: 2 }) === 10, "cagr");

assert(calculateEMI(1200000, 10, 12) > 0, "emi");

console.log("Calculator math checks passed.");
