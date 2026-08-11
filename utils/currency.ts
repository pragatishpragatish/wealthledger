/**
 * Indian (en-IN) currency formatting helpers.
 * Examples: ₹1,000 | ₹12,500 | ₹1,25,000 | ₹12,34,567
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrFormatterPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatINR(amount: number, opts?: { precise?: boolean }): string {
  if (opts?.precise) return inrFormatterPrecise.format(amount);
  return inrFormatter.format(Math.round(amount));
}

export function formatINRCompact(amount: number): string {
  return inrCompact.format(amount);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatSignedINR(amount: number): string {
  const formatted = formatINR(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted.replace("₹", "₹")}`;
  return formatted;
}

/** Mask account number showing last 4 digits: ******7890 */
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return "—";
  const cleaned = accountNumber.replace(/\s/g, "");
  if (cleaned.length <= 4) return cleaned;
  return `${"*".repeat(Math.min(cleaned.length - 4, 8))}${cleaned.slice(-4)}`;
}
