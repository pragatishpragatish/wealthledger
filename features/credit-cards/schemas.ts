import { z } from "zod";
import { CREDIT_CARD_REWARD_TYPES } from "@/lib/constants";
import {
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
