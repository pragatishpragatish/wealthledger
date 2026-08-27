import { z } from "zod";
import { INVESTMENT_TYPES } from "@/lib/constants";
import {
  dateStringSchema,
  nonNegativeMoneySchema,
  optionalNullableString,
  positiveMoneySchema,
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
    units: z.preprocess(
      (v) => (v === "" || v == null ? 0 : v),
      z.coerce
        .number({ invalid_type_error: "Enter valid units" })
        .min(0, "Units cannot be negative")
    ),
    buy_price: nonNegativeMoneySchema,
    current_price: nonNegativeMoneySchema,
    invested_amount: nonNegativeMoneySchema,
    current_value: nonNegativeMoneySchema,
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
    /** Funding account — broker wallet for stocks/ETF, bank for MF/bonds. */
    account_id: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    /** When false, only records the holding (no wallet/bank debit). */
    debit_account: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const amounts = resolveInvestmentAmounts(data);
    if (amounts.invested_amount <= 0 && amounts.current_value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter invested amount, current value, or units with prices",
        path: ["invested_amount"],
      });
    }
    if (
      data.debit_account !== false &&
      amounts.invested_amount > 0 &&
      !data.account_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the account this investment is paid from",
        path: ["account_id"],
      });
    }
  });

export type InvestmentFormValues = z.infer<typeof investmentSchema>;

export const contributionSchema = z
  .object({
    date: dateStringSchema,
    amount: positiveMoneySchema,
    units: z.preprocess(
      (v) => (v === "" || v == null ? 0 : v),
      z.coerce
        .number({ invalid_type_error: "Enter valid units" })
        .min(0, "Units cannot be negative")
    ),
    price: nonNegativeMoneySchema,
    notes: optionalNullableString,
    account_id: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    debit_account: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.debit_account !== false && !data.account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the account this top-up is paid from",
        path: ["account_id"],
      });
    }
  });

export type ContributionFormValues = z.infer<typeof contributionSchema>;

export const tradingPnlSchema = z.object({
  account_id: z.string().uuid("Select a broker wallet"),
  activity: z.enum(["fno", "intraday", "other"]),
  result: z.enum(["profit", "loss"]),
  amount: positiveMoneySchema,
  date: dateStringSchema,
  notes: optionalNullableString,
});

export type TradingPnlFormValues = z.infer<typeof tradingPnlSchema>;

/** Derive amounts from units/prices when provided. */
export function resolveInvestmentAmounts(
  values: Pick<
    InvestmentFormValues,
    | "units"
    | "buy_price"
    | "current_price"
    | "invested_amount"
    | "current_value"
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
