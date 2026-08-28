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
    symbol: optionalNullableString,
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
    /** Purchase amount — optional if units × price are set. */
    amount: nonNegativeMoneySchema,
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
    const amount = Number(data.amount) || 0;
    const units = Number(data.units) || 0;
    const price = Number(data.price) || 0;
    const resolved =
      amount > 0
        ? amount
        : units > 0 && price > 0
          ? Math.round(units * price * 100) / 100
          : 0;
    if (resolved <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter amount, or units with price / NAV",
        path: ["amount"],
      });
    }
    if (data.debit_account !== false && !data.account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the account this top-up is paid from",
        path: ["account_id"],
      });
    }
  });

export type ContributionFormValues = z.infer<typeof contributionSchema>;

/** Partial or full redemption / sell of units (stocks, ETF, MF, crypto). */
export const withdrawalSchema = z
  .object({
    date: dateStringSchema,
    units: z.preprocess(
      (v) => (v === "" || v == null ? 0 : v),
      z.coerce
        .number({ invalid_type_error: "Enter valid units" })
        .min(0, "Units cannot be negative")
    ),
    /** Sale proceeds — optional if units × price are set. */
    amount: nonNegativeMoneySchema,
    price: nonNegativeMoneySchema,
    notes: optionalNullableString,
    account_id: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    /** Credit sale proceeds to funding account. */
    credit_account: z.boolean().default(true),
    /** Deactivate holding when units reach zero. */
    close_if_empty: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const amount = Number(data.amount) || 0;
    const units = Number(data.units) || 0;
    const price = Number(data.price) || 0;
    const hasUnits = units > 0;
    const hasProceeds =
      amount > 0 || (units > 0 && price > 0);
    if (!hasUnits && !(amount > 0 && price > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter units to sell, or amount with sale price / NAV",
        path: ["units"],
      });
    }
    if (!hasProceeds && !hasUnits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter sale amount or price",
        path: ["amount"],
      });
    }
    if (data.credit_account !== false && !data.account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select the account to receive proceeds",
        path: ["account_id"],
      });
    }
  });

export type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

/** Types that support unit buys / partial sells. */
export function supportsUnitTrades(type: (typeof INVESTMENT_TYPES)[number]["value"]) {
  return (
    type === "stocks" ||
    type === "etf" ||
    type === "mutual_funds" ||
    type === "crypto"
  );
}

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

/** Resolve buy/sell cash amount and units from form fields. */
export function resolveTradeAmounts(values: {
  amount?: number | null;
  units?: number | null;
  price?: number | null;
}) {
  let amount = Number(values.amount) || 0;
  let units = Number(values.units) || 0;
  let price = Number(values.price) || 0;

  if (units <= 0 && amount > 0 && price > 0) {
    units = Math.round((amount / price) * 1e6) / 1e6;
  }
  if (price <= 0 && units > 0 && amount > 0) {
    price = Math.round((amount / units) * 10000) / 10000;
  }
  if (amount <= 0 && units > 0 && price > 0) {
    amount = Math.round(units * price * 100) / 100;
  }

  return { amount, units, price };
}
