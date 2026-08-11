import { z } from "zod";

/** Coerce form strings / numbers into a finite money amount. */
export const moneySchema = z.coerce
  .number({
    invalid_type_error: "Enter a valid amount",
    required_error: "Amount is required",
  })
  .finite("Enter a valid amount");

export const positiveMoneySchema = moneySchema.positive(
  "Amount must be greater than zero"
);

export const nonNegativeMoneySchema = moneySchema.min(
  0,
  "Amount cannot be negative"
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
