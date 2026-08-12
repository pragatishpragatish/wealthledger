import { z } from "zod";
import { PAYMENT_METHODS, RECURRING_FREQUENCIES } from "@/lib/constants";
import {
  dateStringSchema,
  optionalNullableString,
  positiveMoneySchema,
} from "@/lib/validations/common";

const paymentValues = PAYMENT_METHODS.map((p) => p.value) as [
  (typeof PAYMENT_METHODS)[number]["value"],
  ...(typeof PAYMENT_METHODS)[number]["value"][],
];

const frequencyValues = RECURRING_FREQUENCIES.map((f) => f.value) as [
  (typeof RECURRING_FREQUENCIES)[number]["value"],
  ...(typeof RECURRING_FREQUENCIES)[number]["value"][],
];

export const expenseSchema = z
  .object({
    date: dateStringSchema,
    amount: positiveMoneySchema,
    category_id: z.string().uuid("Select a category").optional().nullable(),
    account_id: z
      .string()
      .uuid("Select an account")
      .optional()
      .nullable()
      .or(z.literal("")),
    credit_card_id: z
      .string()
      .uuid("Select a credit card")
      .optional()
      .nullable()
      .or(z.literal("")),
    merchant: optionalNullableString,
    payment_method: z.enum(paymentValues).optional().nullable(),
    notes: optionalNullableString,
    tags: z.string().optional(),
    receipt_url: z
      .string()
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null || v.trim() === "") return null;
        return v.trim();
      })
      .refine(
        (v) => v === null || /^https?:\/\/.+/i.test(v),
        "Enter a valid URL starting with http:// or https://"
      ),
    is_recurring: z.boolean(),
    recurring_frequency: z.enum(frequencyValues).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const accountId =
      data.account_id && data.account_id !== "" ? data.account_id : null;
    const cardId =
      data.credit_card_id && data.credit_card_id !== ""
        ? data.credit_card_id
        : null;

    if (!accountId && !cardId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a bank account or credit card",
        path: ["account_id"],
      });
    }
    if (accountId && cardId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either an account or a credit card, not both",
        path: ["account_id"],
      });
    }
    if (data.is_recurring && !data.recurring_frequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a frequency for recurring expense",
        path: ["recurring_frequency"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    account_id:
      data.account_id && data.account_id !== "" ? data.account_id : null,
    credit_card_id:
      data.credit_card_id && data.credit_card_id !== ""
        ? data.credit_card_id
        : null,
  }));

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
