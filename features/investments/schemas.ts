import { z } from "zod";
import { INVESTMENT_TYPES } from "@/lib/constants";
import {
  dateStringSchema,
  nonNegativeMoneySchema,
  optionalNullableString,
} from "@/lib/validations/common";

const investmentTypeValues = INVESTMENT_TYPES.map((t) => t.value) as [
  (typeof INVESTMENT_TYPES)[number]["value"],
  ...(typeof INVESTMENT_TYPES)[number]["value"][],
];

const optionalDate = z
  .union([dateStringSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    return v;
  });

export const investmentSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150),
    type: z.enum(investmentTypeValues),
    platform: optionalNullableString,
    purchase_date: optionalDate,
    units: z.coerce
      .number({ invalid_type_error: "Enter valid units" })
      .min(0, "Units cannot be negative")
      .default(0),
    buy_price: nonNegativeMoneySchema.default(0),
    current_price: nonNegativeMoneySchema.default(0),
    invested_amount: nonNegativeMoneySchema.default(0),
    current_value: nonNegativeMoneySchema.default(0),
    maturity_date: optionalDate,
    interest_rate: z
      .union([
        z.coerce
          .number({ invalid_type_error: "Enter a valid rate" })
          .min(0, "Rate cannot be negative")
          .max(100, "Rate seems too high"),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => {
        if (v === "" || v == null) return null;
        return v;
      }),
    notes: optionalNullableString,
    is_active: z.boolean().default(true),
    is_sip: z.boolean().default(false),
    sip_amount: nonNegativeMoneySchema.default(0),
    sip_day: z
      .union([
        z.coerce
          .number({ invalid_type_error: "Enter SIP day" })
          .int()
          .min(1, "Day must be 1–28")
          .max(28, "Day must be 1–28"),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => {
        if (v === "" || v == null) return null;
        return v;
      }),
    sip_frequency: z
      .enum(["monthly", "weekly", "quarterly"])
      .nullable()
      .optional()
      .transform((v) => v ?? "monthly"),
    sip_start_date: optionalDate,
  })
  .superRefine((data, ctx) => {
    if (data.is_sip) {
      if (data.sip_amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter monthly SIP amount",
          path: ["sip_amount"],
        });
      }
      if (!data.sip_day) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick SIP debit day (1–28)",
          path: ["sip_day"],
        });
      }
    }

    const amounts = resolveInvestmentAmounts(data);
    if (amounts.invested_amount <= 0 && amounts.current_value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: data.is_sip
          ? "Enter total invested so far or current value"
          : "Enter invested amount, current value, or units with prices",
        path: ["invested_amount"],
      });
    }
  });

export type InvestmentFormValues = z.infer<typeof investmentSchema>;

/** Derive amounts from units/prices when provided. */
export function resolveInvestmentAmounts(
  values: Pick<
    InvestmentFormValues,
    | "units"
    | "buy_price"
    | "current_price"
    | "invested_amount"
    | "current_value"
    | "is_sip"
    | "sip_amount"
  >
) {
  let invested_amount = Number(values.invested_amount) || 0;
  let current_value = Number(values.current_value) || 0;
  const units = Number(values.units) || 0;
  const buy_price = Number(values.buy_price) || 0;
  const current_price = Number(values.current_price) || 0;

  if (units > 0 && buy_price > 0) {
    invested_amount = Math.round(units * buy_price * 100) / 100;
  }
  if (units > 0 && current_price > 0) {
    current_value = Math.round(units * current_price * 100) / 100;
  }

  // SIP with only SIP amount filled — seed invested if still empty
  if (
    values.is_sip &&
    invested_amount <= 0 &&
    Number(values.sip_amount) > 0 &&
    current_value <= 0
  ) {
    invested_amount = Number(values.sip_amount);
  }

  // If only current value set for SIP, keep invested as entered
  if (current_value <= 0 && invested_amount > 0) {
    current_value = invested_amount;
  }

  const gain = Math.round((current_value - invested_amount) * 100) / 100;
  const gain_percent =
    invested_amount > 0
      ? Math.round((gain / invested_amount) * 10000) / 100
      : 0;

  return { invested_amount, current_value, gain, gain_percent };
}
