/**
 * Convert a number to Indian-English words (crore / lakh / thousand).
 * Examples: 125000 → "One lakh twenty-five thousand rupees"
 */

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const ten = Math.floor(n / 10);
  const one = n % 10;
  if (one === 0) return TENS[ten] ?? "";
  return `${TENS[ten]}-${ONES[one]}`;
}

function threeDigits(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigits(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (rest === 0) return `${ONES[hundred]} hundred`;
  return `${ONES[hundred]} hundred ${twoDigits(rest)}`;
}

/** Whole rupees in Indian numbering words. Returns "" for empty/invalid. */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";

  const whole = Math.floor(Math.abs(amount));
  if (whole === 0) return "Zero rupees";

  const crore = Math.floor(whole / 1_00_00_000);
  const lakh = Math.floor((whole % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((whole % 1_00_000) / 1_000);
  const hundred = whole % 1_000;

  const parts: string[] = [];
  if (crore > 0) {
    parts.push(
      `${crore < 100 ? twoDigits(crore) : threeDigits(crore)} crore`
    );
  }
  if (lakh > 0) {
    parts.push(`${twoDigits(lakh)} lakh`);
  }
  if (thousand > 0) {
    parts.push(`${twoDigits(thousand)} thousand`);
  }
  if (hundred > 0) {
    parts.push(threeDigits(hundred));
  }

  const body = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!body) return "Zero rupees";

  const capitalized = body.charAt(0).toUpperCase() + body.slice(1);
  return `${capitalized} rupees`;
}
