import { z } from "zod";

/** Treat blank form values as missing (do not coerce "" → 0). */
function emptyToUndefined(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

/** Blank / missing → 0 (optional money fields, SIP-style). */
function emptyToZero(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "string" && value.trim() === "") return 0;
  return value;
}

const finiteNumber = z.coerce
  .number({
    invalid_type_error: "Enter a valid amount",
    required_error: "Amount is required",
  })
  .finite("Enter a valid amount");

/** Coerce form strings / numbers into a finite money amount. Blank stays empty. */
export const moneySchema = z.preprocess(emptyToUndefined, finiteNumber);

export const positiveMoneySchema = z.preprocess(
  emptyToUndefined,
  finiteNumber.positive("Amount must be greater than zero")
);

/** Blank counts as zero (like SIP calculator optional fields). */
export const nonNegativeMoneySchema = z.preprocess(
  emptyToZero,
  finiteNumber.min(0, "Amount cannot be negative")
);

/** Trim; empty → null. Keeps input/output as string | null for RHF. */
export function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const optionalNullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => emptyToNull(v ?? null));

export const dateStringSchema = z
  .string()
  .min(1, "Date is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");
