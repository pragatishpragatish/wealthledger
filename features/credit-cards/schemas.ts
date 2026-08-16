import { z } from "zod";
import { CREDIT_CARD_REWARD_TYPES } from "@/lib/constants";
import {
  dateStringSchema,
  nonNegativeMoneySchema,
  optionalNullableString,
  positiveMoneySchema,
} from "@/lib/validations/common";

const rewardValues = CREDIT_CARD_REWARD_TYPES.map((r) => r.value) as [
  (typeof CREDIT_CARD_REWARD_TYPES)[number]["value"],
  ...(typeof CREDIT_CARD_REWARD_TYPES)[number]["value"][],
];

const dayOfMonth = z.coerce
  .number({ invalid_type_error: "Enter a day between 1 and 31" })
  .int("Must be a whole number")
  .min(1, "Day must be between 1 and 31")
  .max(31, "Day must be between 1 and 31");

export const creditCardSchema = z.object({
  bank: z.string().trim().min(1, "Bank is required").max(100),
  card_name: z.string().trim().min(1, "Card name is required").max(100),
  last_four: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v.trim() === "") return null;
      return v.trim();
    })
    .refine(
      (v) => v === null || /^\d{4}$/.test(v),
      "Enter the last 4 digits"
    ),
  credit_limit: positiveMoneySchema,
  outstanding: nonNegativeMoneySchema,
  statement_amount: nonNegativeMoneySchema,
  minimum_due: nonNegativeMoneySchema,
  paid_amount: nonNegativeMoneySchema,
  billing_date: dayOfMonth,
  due_date: dayOfMonth,
  interest_rate: z.preprocess(
    (v) => (v === "" || v == null ? 0 : v),
    z.coerce
      .number({ invalid_type_error: "Enter a valid rate" })
      .min(0, "Rate cannot be negative")
      .max(100, "Rate seems too high")
  ),
  reward_type: z.enum(rewardValues),
  notes: optionalNullableString,
  is_active: z.boolean(),
});

export type CreditCardFormValues = z.infer<typeof creditCardSchema>;

export const creditCardPaymentSchema = z.object({
  account_id: z.string().uuid("Select an account"),
  amount: positiveMoneySchema,
  date: dateStringSchema,
  notes: optionalNullableString,
});

export type CreditCardPaymentValues = z.infer<typeof creditCardPaymentSchema>;

export const convertToEmiSchema = z.object({
  source_transaction_id: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
  description: z.string().trim().min(1, "Description is required").max(200),
  principal: positiveMoneySchema,
  interest_rate: z.coerce
    .number({ invalid_type_error: "Enter a valid rate" })
    .min(0)
    .max(100),
  tenure_months: z.coerce
    .number({ invalid_type_error: "Enter tenure" })
    .int()
    .min(1, "At least 1 month")
    .max(96, "Max 96 months"),
  processing_fee: nonNegativeMoneySchema,
  start_date: dateStringSchema,
});

export type ConvertToEmiValues = z.infer<typeof convertToEmiSchema>;

export const recordEmiPaymentSchema = z.object({
  emi_id: z.string().uuid(),
  account_id: z.string().uuid("Select an account"),
  date: dateStringSchema,
  notes: optionalNullableString,
});

export type RecordEmiPaymentValues = z.infer<typeof recordEmiPaymentSchema>;
